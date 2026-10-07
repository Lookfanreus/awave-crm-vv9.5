-- 0022_canais.sql — canal de mensageria, conversas e mensagens.
--
-- ⚠️ ADITIVA. Migration que falha = container que NAO SOBE, em toda instalacao: o
-- EasyPanel mantem a versao anterior e o comprador fica sem entender por que a
-- atualizacao "nao pegou". Nada aqui exige ownership de tabela do Supabase.

create table if not exists public.canais (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('uazapi')),
  nome text not null,
  -- E.164, preenchido so depois do pareamento. Nulo ate la.
  telefone text,
  -- Id da instancia na conta do provider. Ver o indice unico GLOBAL abaixo.
  external_id text,
  status_conexao text not null default 'desconectado'
    check (status_conexao in ('desconectado', 'pareando', 'conectado', 'erro')),
  -- Nao-secreto: server_url, nome da instancia. Segredo mora no Vault.
  config jsonb not null default '{}'::jsonb,
  -- 🔴 Contador de eventos REPROVADOS pela camada 2 de verificacao. A rota devolve 200 nesses
  -- casos (500 faria o provider reenviar para sempre um evento que nunca sera aceito) — e 200
  -- MUDO, num endpoint com varios workspaces, e sensor desligado: quem sonda `external_id`
  -- com um segredo de caminho valido nao deixaria rastro nenhum. A tela mostra "N eventos
  -- rejeitados" quando passa de zero. O incremento e ATOMICO, por uma funcao propria.
  eventos_rejeitados int not null default 0,
  rejeitado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 🔴 UNICO NO DEPLOY, contrariando a regra geral de "unico por workspace" de proposito.
-- `external_id` identifica uma instancia na conta do provider, que e do DEPLOY. Unico por
-- workspace deixaria dois canais de workspaces diferentes apontando para a mesma
-- instancia: a verificacao de evento passa nos dois e a MESMA conversa e gravada em dois
-- workspaces — vazamento por configuracao, sem exploit nenhum.
create unique index if not exists canais_external_id_key on public.canais (external_id)
  where external_id is not null;
create index if not exists canais_workspace_idx on public.canais (workspace_id);

create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  canal_id uuid not null references public.canais(id) on delete cascade,
  contato_id uuid references public.contatos(id) on delete set null,
  -- O chat id do provider.
  chave_externa text not null,
  status text not null default 'aberta' check (status in ('aberta', 'arquivada')),
  -- Ultima mensagem de QUALQUER direcao: ordena a lista da caixa de entrada.
  ultima_mensagem_em timestamptz,
  -- Ultima mensagem DO CLIENTE: e o relogio da janela de 24h e do follow-up automatico.
  -- As duas NAO sao redundantes; confundi-las faz o follow-up contar a partir da nossa
  -- propria mensagem, que e o erro que transforma "recuperar lead" em cobranca.
  ultima_msg_in_at timestamptz,
  nao_lidas int not null default 0,
  atribuida_a uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (workspace_id, canal_id, chave_externa)
);

-- 🔴 FK COMPOSTA, igual a negocios.responsavel_id (0004). FK simples para membros(id)
-- deixaria atribuir conversa a membro de OUTRO workspace. MATCH SIMPLE: nulo nao checa.
-- GUARDADA pelo `pg_constraint`, como as FKs compostas da 0025 e da 0028: `add constraint`
-- nao aceita `if not exists`, e num arquivo que declara tolerar objeto pre-existente ela
-- seria a instrucao que para a reexecucao no meio, com `42710`.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'conversas_atribuida_fk' and conrelid = 'public.conversas'::regclass
  ) then
    alter table public.conversas
      add constraint conversas_atribuida_fk
      foreign key (workspace_id, atribuida_a)
      references public.membros (workspace_id, id) on delete set null (atribuida_a);
  end if;
end $$;
create index if not exists conversas_workspace_idx on public.conversas (workspace_id);
create index if not exists conversas_lista_idx on public.conversas (workspace_id, status, ultima_mensagem_em desc);

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  -- Id da mensagem no provider. E a chave de idempotencia (indice abaixo) e o alvo do ack.
  externo_id text,
  direcao text not null check (direcao in ('entrada', 'saida')),
  autor text not null check (autor in ('contato', 'membro', 'aparelho')),
  texto text not null default '',
  midia jsonb,
  status text not null
    check (status in ('recebida', 'pendente', 'enviada', 'entregue', 'lida', 'falhou')),
  -- Timestamp do PROVIDER. A ordenacao da thread usa este, nunca o criado_em: sob retry
  -- e atraso, duas mensagens invertem.
  origem_em timestamptz not null,
  -- Fila de saida, no mesmo padrao do outbox da 0007, com predicado proprio.
  tentativas int,
  proxima_tentativa timestamptz,
  ultimo_erro text,
  desistido_em timestamptz,
  -- 🔴 Marcador de "em voo": gravado na reserva, limpo no desfecho. Existe porque
  -- proxima_tentativa NAO distingue "reservada, enviando agora" de "backoff agendado" —
  -- as duas sao timestamp futuro —, e sem a distincao o orfao da 2a tentativa em diante e
  -- REENVIADO ao cliente.
  enviando_desde timestamptz,
  criado_em timestamptz not null default now()
);

-- Idempotencia: webhook reenvia SEMPRE. Por workspace, como manda a convencao do repo.
create unique index if not exists mensagens_externo_id_key on public.mensagens (workspace_id, externo_id)
  where externo_id is not null;
create index if not exists mensagens_workspace_idx on public.mensagens (workspace_id);
-- A thread: ordenada por origem_em, sem coalesce (a coluna nasce junto, nao ha linha antiga).
create index if not exists mensagens_thread_idx on public.mensagens (conversa_id, origem_em desc);

-- ── RLS ────────────────────────────────────────────────────────────────────────────────
--
-- 🔴 `for select to authenticated`, e NAO `for all` — que e o padrao dominante deste banco.
-- `for all` sempre foi inofensivo por um motivo que a CAIXA DE ENTRADA vai revogar: NENHUMA
-- TELA TINHA CLIENTE SUPABASE NO NAVEGADOR. A caixa de entrada manda a chave anon para o
-- navegador (para o Realtime), e a partir dai `for all` significa INSERT/UPDATE/DELETE direto
-- no PostgREST, pulando o servidor — e com ele os invariantes que policy nenhuma expressa: o
-- patch que barra a alteracao de chave_externa, a mesclagem que valida jsonb por tipo, o
-- anti-loop das automacoes.
--
-- O precedente do formato certo ja existe neste banco: a 0013 usa `for select` em
-- execucoes_automacao, a tabela que so o servidor escreve. Estas tres sao esse caso.
--
-- ⚠️ CONSEQUENCIA QUE PRECISA VIR ESCRITA: com `for select`, uma escrita feita pelo cliente
-- da SESSAO do usuario NAO DA ERRO — ela afeta ZERO LINHAS. O contador de nao-lidas nunca
-- zeraria, arquivar nao arquivaria, e nao ha excecao, log nem tela para acusar. Nas TRES
-- tabelas a regra e a mesma: leitura pela sessao, escrita pelo cliente service-role com
-- `.eq('workspace_id', ...)` explicito no codigo.

alter table public.canais    enable row level security;
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;

-- 🔴 AS SEIS SAO GUARDADAS PELO `pg_policies`, uma a uma: o Postgres nao tem `create policy
-- if not exists`. E o par obrigatorio do `if not exists` que as tabelas e os indices deste
-- arquivo usam — declarar tolerancia a objeto pre-existente e logo abaixo emitir DDL nu faz
-- a reexecucao parar no MEIO, com um `42710` cru, e migration que falha e container que NAO
-- SOBE em toda instalacao. O estado que reabre isso e o que este repositorio ja viveu:
-- migration aplicada a mao pelo editor de SQL com o registro em `public.awave_migrations`
-- incompleto — no boot seguinte o aplicador a considera pendente e reaplica o arquivo TODO.
--
-- ⚠️ A guarda le o NOME, nunca o conteudo: numa base onde uma policy de mesmo nome ja exista
-- com outro predicado, ela fica como esta. Trocar isto por `drop policy if exists` + `create`
-- (o idioma da 0021) reescreveria o predicado dela sem avisar — e aqui, ao contrario da 0021,
-- nao ha rebaixamento nenhum a fazer.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'canais' and policyname = 'canais_service'
  ) then
    create policy canais_service on public.canais for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'conversas' and policyname = 'conversas_service'
  ) then
    create policy conversas_service on public.conversas for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'mensagens' and policyname = 'mensagens_service'
  ) then
    create policy mensagens_service on public.mensagens for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'canais' and policyname = 'canais_membro'
  ) then
    create policy canais_membro on public.canais for select to authenticated using (public.e_membro(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'conversas' and policyname = 'conversas_membro'
  ) then
    create policy conversas_membro on public.conversas for select to authenticated using (public.e_membro(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'mensagens' and policyname = 'mensagens_membro'
  ) then
    create policy mensagens_membro on public.mensagens for select to authenticated using (public.e_membro(workspace_id));
  end if;
end $$;

-- ── contatos.telefone_sufixo ───────────────────────────────────────────────────────────
--
-- 🔴 CANDIDATO DE INDICE, NAO VEREDITO. Os 8 ultimos digitos servem para achar os poucos
-- candidatos sem varrer a tabela. Eles NAO decidem nada: 8 digitos descartam o nono
-- digito E O DDD JUNTO, entao (11) 99120-6753 e (14) 99120-6753 produzem o mesmo valor.
-- Casar contato por aqui funde duas pessoas diferentes num registro so, e isso nao se
-- desfaz. Quem decide e a comparacao de telefone do codigo, que canonicaliza o numero
-- inteiro antes de comparar.
--
-- Indice COMUM. Unico falharia ao aplicar — o comprador ja tem duplicatas de telefone, e
-- migration que falha e container que nao sobe.
alter table public.contatos add column if not exists telefone_sufixo text;

create index if not exists contatos_telefone_sufixo_idx
  on public.contatos (workspace_id, telefone_sufixo)
  where telefone_sufixo is not null;

-- Backfill: e trabalho sobre DADO DO COMPRADOR, nao DDL. Telefone que nao produz 8
-- digitos fica NULO — nunca chuta. Contato assim simplesmente nao casa por telefone, que
-- e o comportamento honesto.
--
-- 🔴 A FAIXA E A MESMA QUE O CODIGO ACEITA: 8 <= digitos <= 15. O teto e o E.164 — sem ele,
-- 300 digitos seriam "telefone valido". Se o backfill indexasse o que o codigo recusa, a
-- coluna significaria uma coisa nas linhas antigas e outra nas novas: a linha antiga viraria
-- candidata do indice e so seria descartada la na frente, na comparacao. Desperdicio
-- silencioso, e uma divergencia que ninguem consegue ver.
--
-- O `telefone_sufixo is null` no filtro mantem o backfill re-executavel: o boot reaplica
-- migration pendente, e uma segunda passada nao pode reescrever o que ja foi calculado.
update public.contatos
   set telefone_sufixo = right(regexp_replace(telefone, '\D', '', 'g'), 8)
 where telefone is not null
   and telefone_sufixo is null
   and length(regexp_replace(telefone, '\D', '', 'g')) >= 8
   and length(regexp_replace(telefone, '\D', '', 'g')) <= 15;

-- ── Bucket de midia ────────────────────────────────────────────────────────────────────
--
-- 🔴 PRIVADO, e SEM POLICY NENHUMA. O 0018_marca_bucket.sql deste banco antecipou este
-- momento e deixou escrito: "reusar este bucket e real. NAO REUSE: as politicas sao
-- OPOSTAS... Um anexo num bucket publico e vazamento com URL adivinhavel." E o motivo de
-- nao criar policy esta la tambem: `create policy ... on storage.objects` exige ser DONO
-- da tabela, e o erro e `must be owner of table objects` — migration que falha e
-- container que NAO SOBE, em toda instalacao.
--
-- O acesso e por URL ASSINADA cunhada no servidor com o cliente service-role, que bypassa
-- RLS por definicao. O isolamento e o codigo que cunha a URL, e ele so cunha depois de ler
-- a LINHA de mensagens com o filtro de workspace.
--
-- Teto e allowlist de mime seguem o 0018 (que os tem, com motivo escrito) e nao o outro
-- produto da linha (que nao tem nenhum dos dois).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'canais-midia', 'canais-midia', false, 20971520,
  array['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','video/mp4','application/pdf']
)
on conflict (id) do nothing;

-- ── Realtime ───────────────────────────────────────────────────────────────────────────
--
-- 🔴 GUARDADO. `alter publication` tambem exige ownership, e este produto nunca tocou
-- publicacao nenhuma. Falhar em ligar o Realtime DEGRADA a experiencia (a caixa de entrada
-- pede F5); falhar a migration derruba a instalacao inteira. O raise notice chega ao log do
-- comprador: o migrate.mjs registra onnotice de proposito.
--
-- So mensagens e conversas. `canais` fica de fora: nada na tela depende de reagir a
-- mudanca de canal em tempo real, e canal e a tabela com os campos mais sensiveis.
do $$
begin
  alter publication supabase_realtime add table public.mensagens;
  alter publication supabase_realtime add table public.conversas;
exception when others then
  raise notice '[0022] nao foi possivel ligar o tempo real (%). A caixa de entrada vai precisar de F5.', sqlerrm;
end $$;

-- ── RPCs de escrita da conversa ────────────────────────────────────────────────────────
--
-- 🔴 O INCREMENTO E ATOMICO PORQUE ELE PRECISA SER. Ler `nao_lidas`, somar 1 no servidor e
-- gravar de volta perde contagem quando duas mensagens do mesmo cliente chegam juntas — as
-- duas leem o mesmo valor e gravam o mesmo valor. O provider ENTREGA EM PARALELO, e o
-- webhook reenvia, entao a corrida e o caso normal, nao o excepcional. O resultado do bug e
-- silencioso e ruim de explicar: a mensagem aparece na thread e o contador nao a conta.
-- `nao_lidas + 1` dentro do UPDATE resolve porque a soma acontece sob o lock da linha.
--
-- 🔴 E os timestamps usam `greatest`, nao atribuicao direta. Evento chega FORA DE ORDEM
-- (e o motivo de `origem_em` existir): sem o `greatest`, uma reentrega atrasada empurra
-- `ultima_mensagem_em` para tras e a conversa pula para o fim da lista da caixa de entrada.
create or replace function public.registrar_mensagem_na_conversa(
  p_ws uuid, p_conversa uuid, p_quando timestamptz, p_entrada boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.conversas c
     set ultima_mensagem_em = greatest(coalesce(c.ultima_mensagem_em, p_quando), p_quando),
         -- Volta para 'aberta': mensagem nova reabre conversa arquivada.
         status = 'aberta',
         ultima_msg_in_at = case when p_entrada
           then greatest(coalesce(c.ultima_msg_in_at, p_quando), p_quando)
           else c.ultima_msg_in_at end,
         nao_lidas = case when p_entrada then c.nao_lidas + 1 else c.nao_lidas end,
         atualizado_em = now()
   where c.workspace_id = p_ws and c.id = p_conversa;
end $$;

-- Contador de eventos reprovados pela segunda camada de verificacao. Mesmo motivo de ser
-- RPC: sao N containers e M requests concorrentes, e um contador lido-e-escrito perde evento
-- exatamente quando ha muitos deles — que e o unico momento em que alguem olha para ele.
create or replace function public.incrementar_rejeicoes_canal(p_ws uuid, p_canal uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.canais c
     set eventos_rejeitados = c.eventos_rejeitados + 1,
         rejeitado_em = now()
   where c.workspace_id = p_ws and c.id = p_canal;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de public/anon. No Supabase, ALTER DEFAULT
-- PRIVILEGES concede EXECUTE a `authenticated` na CRIACAO da funcao, entao revogar de
-- public/anon NAO tira esse grant — a 0008 deste banco existe inteira para consertar
-- exatamente essa falha da 0007. Sem estas quatro linhas, qualquer autenticado de qualquer
-- workspace poderia chamar estas funcoes, e `security definer` bypassa RLS: daria para
-- inflar o contador de rejeicoes de outro tenant e para reabrir conversa arquivada alheia
-- passando um uuid adivinhado. Elas recebem id do chamador; e a regra da casa.
--
-- ⚠️ E o `p_ws` nao e decorativo em nenhuma das duas. Rodando como dono da funcao, a RLS nao
-- e avaliada: sem o `where c.workspace_id = p_ws`, um id de outro tenant seria aceito. E a
-- mesma regra do filtro explicito de workspace no codigo, atravessando para dentro do SQL —
-- o `id` ja e chave primaria, e e por isso que a checagem parece redundante e nao e.
revoke all on function public.registrar_mensagem_na_conversa(uuid, uuid, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.registrar_mensagem_na_conversa(uuid, uuid, timestamptz, boolean)
  to service_role;
revoke all on function public.incrementar_rejeicoes_canal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.incrementar_rejeicoes_canal(uuid, uuid) to service_role;

-- ── Reserva atomica da fila de saida ───────────────────────────────────────────────────
--
-- 🔴 `for update skip locked` e o que permite mais de um processo drenando a mesma fila sem
-- que os dois peguem a MESMA linha e o cliente receba a mensagem duas vezes. E o mesmo
-- padrao do outbox de webhook deste banco.
--
-- 🔴 ELA NAO RECEBE workspace, e a excecao e deliberada: o dreno roda no tick, que e um
-- processo do deploy e nao uma sessao — nao existe "workspace atual" ali. Filtrar por
-- workspace obrigaria a varrer workspace a workspace, e um deploy com 30 workspaces faria 30
-- consultas a cada tick para drenar uma fila que e naturalmente uma so. O isolamento nao cai
-- junto: o workspace_id de cada linha vem do banco e escopa tudo o que o codigo toca depois.
--
-- 🔴 `coalesce(m.enviando_desde, now())` — PRESERVA o carimbo de quem ja estava em voo, em
-- vez de sobrescreve-lo. Sobrescrever apaga a unica evidencia de que a linha foi reservada
-- por um processo que morreu no meio do envio, e a regra do orfao (que existe para NAO
-- reenviar uma mensagem que talvez ja tenha chegado ao cliente) fica sem como decidir: toda
-- linha pareceria recem-reservada, e toda linha seria reenviada.
--
-- ⚠️ E por isso `p_reserva` tem de ser >= a idade que o codigo trata como orfa. Menor que
-- isso, a linha volta a ser elegivel ANTES de virar orfa, e o dreno a reenvia — que e
-- exatamente o "na duvida, envia" que o marcador existe para impedir.
create or replace function public.reservar_mensagens(p_limite int, p_reserva interval)
returns setof public.mensagens language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.mensagens m
     set enviando_desde = coalesce(m.enviando_desde, now()),
         proxima_tentativa = now() + p_reserva
   where m.id in (
     select id from public.mensagens
      where status = 'pendente' and direcao = 'saida' and desistido_em is null
        and coalesce(proxima_tentativa, criado_em) <= now()
      order by criado_em
      limit p_limite
      for update skip locked
   )
  returning m.*;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, pelo mesmo motivo das duas de cima — e aqui o preco e
-- maior: ela e `security definer` e devolve `setof public.mensagens`. Sem estas duas linhas,
-- qualquer autenticado de qualquer workspace chamaria a funcao e leria conversa de TODOS os
-- tenants, porque `security definer` bypassa RLS.
revoke all on function public.reservar_mensagens(int, interval) from public, anon, authenticated;
grant execute on function public.reservar_mensagens(int, interval) to service_role;
