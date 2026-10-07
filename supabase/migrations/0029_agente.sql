-- 0029_agente.sql — o que o assistente automatico precisa guardar.
--
-- Quatro coisas, e nenhuma delas muda o comportamento de quem nao ligar o assistente:
--   1. `conversas.escalada_em` — quando o pedido de atendente disparou pela ultima vez;
--   2. `canais.agente_ligado`  — a chave geral, POR CANAL, que nasce desligada;
--   3. `agente_config`         — como o assistente se apresenta, por espaco de trabalho;
--   4. `custos_ia`             — quanto cada resposta custou, para ninguem tomar susto.
--
-- Tudo aditivo: nenhuma coluna sai, nenhum dominio estreita, nenhuma linha existente muda de
-- valor. Um servidor que atualizar para esta versao e nao ligar nada continua identico.

-- ── 1. A marca da ultima escalacao ─────────────────────────────────────────────────────
--
-- 🔴 E COLUNA, e nao uma leitura do historico. Derivar "ja chamei uma pessoa depois da
-- ultima fala do cliente" relendo mensagens exigiria varrer o fio a cada turno e ainda assim
-- nao distinguiria a escalacao desta conversa das marcas internas do assistente.
--
-- ⚠️ E ELA GUARDA UM CAMINHO QUE HOJE E PERCORRIDO: devolver a conversa ao assistente pela
-- caixa de entrada grava `aberta` de volta, solta o responsavel e o carimbo da pausa. Ate essa
-- acao existir, a unica saida era indireta — arquivar a conversa e esperar o cliente escrever
-- de novo, porque a funcao que registra a mensagem troca `arquivada` por `aberta`. Aquele
-- caminho continua valendo; ele so deixou de ser o unico.
--
-- O laco que este carimbo impede e exatamente o do devolver: o cliente pede um atendente, a
-- pessoa resolve e devolve a conversa ao assistente, mas o pedido continua escrito no
-- historico, para sempre; a primeira mensagem seguinte casaria com ele de novo, a conversa
-- voltaria para a fila humana na hora, e a devolucao se desfaria em um tick. Por isso a acao de
-- devolver NAO limpa esta coluna: limpa-la reabriria o laco que ela existe para fechar.
alter table public.conversas
  add column if not exists escalada_em timestamptz;

-- ── 2. A chave geral do canal ──────────────────────────────────────────────────────────
--
-- 🔴 NASCE DESLIGADA, e o default e a parte importante. Todo servidor que atualizar para
-- esta versao ja tem numero conectado e conversa andando; um default ligado faria a
-- atualizacao comecar a responder cliente de verdade sem ninguem ter pedido.
--
-- E e COLUNA, nao uma chave dentro do jsonb de configuracao do canal, por duas razoes
-- mecanicas. A primeira e o CAMINHO QUENTE: ela e lida em TODA mensagem que chega, junto com a
-- linha que o webhook ja le para se autenticar, e e o que decide se aquela mensagem toca a fila
-- do assistente — cavar dentro do jsonb para isso custaria em cada evento de cada numero. A
-- segunda e de AUTORIDADE: o jsonb ao lado guarda o endereco do servidor de mensagens, que so o
-- dono da instalacao pode editar, e campo compartilhado por duas autoridades diferentes e como
-- uma delas vaza.
--
-- ⚠️ Ela NAO e predicado de consulta nenhuma — nem aqui, nem no dreno. Em todos os pontos ela e
-- `select`ada com a linha e avaliada em JS. Esta linha ja afirmou o contrario, e a diferenca
-- importa para quem for decidir indice: nao ha consulta que se beneficie de um.
alter table public.canais
  add column if not exists agente_ligado boolean not null default false;

-- ── 3. A persona, por espaco de trabalho ───────────────────────────────────────────────
--
-- Uma instalacao pode hospedar varios clientes; tres negocios diferentes, tres jeitos de
-- falar. Uma persona unica faria o assistente de um cliente se apresentar com o nome da
-- empresa do outro — a unica falha desta area visivel para um terceiro que nao e cliente de
-- ninguem. `workspace_id` e a chave primaria: uma persona por espaco, e ponto.
--
-- 🔴 OS TETOS SAO PARTE DO ESQUEMA, e o motivo e de AUTORIDADE, nao de estetica: quem edita
-- estes campos e o dono do espaco de trabalho, e quem paga a fatura de tokens e o dono da
-- instalacao. Sem teto, um texto de 200 KB colado em "sobre o negocio" viaja em toda resposta
-- de toda conversa daquele espaco, na conta de outra pessoa — e nao precisa de ma-fe: colar o
-- site inteiro da empresa nesse campo e o erro mais natural do mundo.
--
-- Os numeros sao escolhidos, nao medidos. 60 cabe "Ana, do time de atendimento da Loja X".
-- 2000 sao cerca de 500 tokens: cabe um paragrafo honesto sobre o negocio e nao cabe um site.
create table if not exists public.agente_config (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  nome text not null default '' check (length(nome) <= 60),
  tratamento text not null default 'voce' check (tratamento in ('voce','senhor')),
  sobre_o_negocio text not null default '' check (length(sobre_o_negocio) <= 2000),
  atualizado_em timestamptz not null default now()
);

alter table public.agente_config enable row level security;

-- GUARDADA pelo `pg_policies`, como a 0028 ja faz: o Postgres nao tem `create policy if not
-- exists`, e este arquivo abre com `create table if not exists`. Declarar tolerancia a tabela
-- pre-existente e logo abaixo emitir a policy nua e o pior dos dois mundos — a reexecucao
-- passa pela tabela e morre aqui, com `42710`, e migration que falha e container que NAO SOBE.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'agente_config'
       and policyname = 'agente_config_service'
  ) then
    create policy agente_config_service on public.agente_config
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- 🔴 `for select`, e NAO `for all`. Desde a caixa de entrada existe cliente Supabase rodando
-- no NAVEGADOR (o tempo real), e no PostgREST nao existe como distinguir "o servidor agindo
-- em nome do usuario" de "o navegador agindo como o usuario" — e o mesmo token. Uma policy de
-- escrita para `authenticated` autoriza a mesma escrita disparada do console do navegador,
-- pulando a tela, a validacao dos tetos acima e o gate de licenca. A escrita sai toda pelo
-- cliente de servico, com o filtro de espaco de trabalho explicito no codigo.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'agente_config'
       and policyname = 'agente_config_membro'
  ) then
    create policy agente_config_membro on public.agente_config
      for select to authenticated using (public.e_membro(workspace_id));
  end if;
end $$;

-- ── 4. O registro de gasto ─────────────────────────────────────────────────────────────
--
-- Com uma chave e uma fatura, quem instalou nao tem como saber quanto o assistente custou ate
-- a fatura chegar. Isto NAO e medidor de cobranca: nao fatura ninguem, nao corta ninguem e
-- nao e base de cobranca nossa. E para ninguem tomar susto.
--
-- 🔴 `custo_usd` E ANULAVEL DE PROPOSITO. A tabela de precos vive no codigo e envelhece:
-- modelo novo, preco mudado, e a instalacao esta numa maquina que ninguem atualiza ha seis
-- meses. Quando o modelo nao esta na tabela, grava-se NADA e a tela mostra so os tokens. Um
-- numero aproximado num painel de custo e pior que um traco: o traco manda a pessoa olhar a
-- fatura; o numero errado a convence de que nao precisa.
--
-- 🔴 `conversa_id` NAO TEM CHAVE ESTRANGEIRA, e a ausencia e a decisao. As conversas
-- cascateiam dos canais, que cascateiam dos espacos de trabalho: com a chave, apagar um canal
-- apagaria junto o registro de QUANTO ele custou — e um historico de gasto que some quando o
-- gasto para de existir nao tem como ser conciliado com a fatura. O id fica como referencia
-- fraca, e a tela mostra "conversa removida" quando nao acha, que e a resposta honesta.
--
-- O `workspace_id`, esse CASCATEIA, e a assimetria e proposital: apagar um canal e rotina;
-- apagar um espaco de trabalho e o cliente indo embora, e linha de custo de um espaco que nao
-- existe mais nao tem como ser rotulada no unico recorte que faz o painel existir.
create table if not exists public.custos_ia (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversa_id uuid,
  modelo text not null,
  tokens_entrada int not null default 0,
  tokens_saida int not null default 0,
  custo_usd numeric(12,6),
  criado_em timestamptz not null default now()
);

-- O recorte "quanto gastou este espaco de trabalho no mes".
create index if not exists custos_ia_mes_idx on public.custos_ia (workspace_id, criado_em desc);
-- O recorte "quanto gastou a instalacao inteira no mes" — que e o que a fatura cobra.
create index if not exists custos_ia_deploy_idx on public.custos_ia (criado_em desc);

alter table public.custos_ia enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'custos_ia'
       and policyname = 'custos_ia_service'
  ) then
    create policy custos_ia_service on public.custos_ia
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- 🔴 SEM POLICY DE MEMBRO, e por um motivo diferente do das outras tabelas internas: esta E
-- lida num painel — so que ATRAVESSANDO espacos de trabalho. Quem le e o dono da instalacao,
-- e ele le todos, porque a chave e uma e a fatura e uma. Isso nao e expressavel numa policy
-- escopada: uma policy de membro daria a ele apenas os espacos de que ele participa, e o
-- painel mostraria menos do que a fatura cobra. A autorizacao mora numa funcao so, no codigo,
-- e a primeira linha dela e a checagem de quem instalou.
