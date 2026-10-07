-- 0039_assistentes.sql — um espaco de trabalho passa a ter MAIS DE UM assistente.
--
-- ⚠️ ADITIVA de ponta a ponta: tabela nova, coluna nova anulavel, indices novos e uma copia do
-- que ja existe. Nenhuma coluna sai, nenhum dominio estreita, nenhuma linha existente muda de
-- valor. Migration que falha e container que NAO SOBE, em toda instalacao — o painel mantem a
-- versao anterior e quem comprou nao entende por que a atualizacao "nao pegou".
--
-- 🔴 A TABELA ANTIGA (`agente_config`) FICA, e a permanencia e a decisao. O Desfazer da
-- atualizacao em 1 clique volta o CODIGO, e nao o banco: derrubar a tabela antiga no mesmo
-- lancamento faria o Desfazer cair num codigo antigo cuja tabela sumiu, e o assistente pararia
-- de responder em toda conversa.
--
-- ⚠️ E o inverso morde igual, entao esta escrito aqui: a partir desta migration `agente_config`
-- fica PARADA no tempo desta copia, e toda edicao passa a ir para `assistentes`. Um Desfazer
-- devolve a persona ao texto anterior, em silencio — e e a tela do Desfazer que precisa dizer
-- isso antes do clique.

-- ── 1. Os assistentes ──────────────────────────────────────────────────────────────────
--
-- 🔴 OS TRES TETOS DE TAMANHO SAO PARTE DO ESQUEMA, e o motivo e de AUTORIDADE, nao de
-- estetica: quem edita estes campos e o dono do espaco de trabalho, e quem paga a fatura de
-- tokens e o dono da INSTALACAO. Sem teto, um texto de 200 KB colado em "sobre o negocio"
-- viaja em TODA resposta de TODA conversa daquele espaco, na conta de outra pessoa — e nao
-- precisa de ma-fe: colar o site inteiro da empresa nesse campo e o erro mais natural do
-- mundo. A validacao da tela NAO substitui isto: ela existe para devolver uma frase em
-- portugues; o `check` e a segunda barreira, e a unica que vale para quem escreve por fora da
-- tela. Os numeros sao os mesmos da persona unica que existia antes.
create table if not exists public.assistentes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- Como o COMPRADOR chama este assistente na tela. Distinto do `nome`, que e como ele se
  -- apresenta ao CLIENTE.
  nome_interno text not null check (length(nome_interno) <= 60),
  nome text not null default '' check (length(nome) <= 60),
  tratamento text not null default 'voce' check (tratamento in ('voce','senhor')),
  sobre_o_negocio text not null default '' check (length(sobre_o_negocio) <= 2000),
  padrao boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Existe para a chave estrangeira COMPOSTA de `canais` poder apontar para ca: uma chave
  -- estrangeira so referencia colunas com unicidade declarada.
  unique (workspace_id, id)
);

alter table public.assistentes enable row level security;

-- GUARDADA pelo `pg_policies`, como a 0028: o Postgres nao tem `create policy if not exists`,
-- e este arquivo abre com `create table if not exists`. Tolerancia declarada em cima e DDL nu
-- embaixo e meia-idempotencia — a reexecucao passa pela tabela e morre aqui, com `42710`, e
-- migration que falha e container que NAO SOBE.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'assistentes'
       and policyname = 'assistentes_service'
  ) then
    create policy assistentes_service on public.assistentes
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- 🔴 `for select`, e NAO `for all`. Desde a caixa de entrada existe cliente do banco rodando no
-- NAVEGADOR (o tempo real), e do lado do servidor de dados nao existe como distinguir "o
-- servidor agindo em nome do usuario" de "o navegador agindo como o usuario" — e o mesmo
-- token. Uma policy de escrita para `authenticated` autoriza a mesma escrita disparada do
-- console, pulando a tela, a validacao dos tetos acima e o gate de licenca. A escrita sai toda
-- pelo cliente de servico, com o filtro de espaco de trabalho explicito no codigo.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'assistentes'
       and policyname = 'assistentes_membro'
  ) then
    create policy assistentes_membro on public.assistentes
      for select to authenticated using (public.e_membro(workspace_id));
  end if;
end $$;

-- ── 2. Os dois indices ─────────────────────────────────────────────────────────────────
--
-- 🔴 NO MAXIMO UM PADRAO por espaco de trabalho, e isto e barreira, nao arrumacao. Um canal sem
-- assistente atribuido cai no padrao: com dois padroes a resolucao do turno passa a ter duas
-- respostas possiveis para a mesma pergunta, e o assistente responderia com uma voz hoje e com
-- outra amanha, sem erro em lugar nenhum.
create unique index if not exists assistentes_padrao_key
  on public.assistentes (workspace_id) where padrao;

-- O unico recorte que a tela faz: "os assistentes deste espaco de trabalho".
create index if not exists assistentes_ws_idx on public.assistentes (workspace_id);

-- ── 3. A persona que ja existe vira o primeiro assistente ──────────────────────────────
--
-- O nome interno vai ESCRITO aqui de proposito. Um valor "obvio" deixado a cargo de quem le
-- viraria duas palavras diferentes em deploys diferentes, e o comprador de cada um veria um
-- rotulo que nenhum guia descreve.
--
-- 🔴 A GUARDA E `where not exists`, e NAO `on conflict do nothing`. O `id` nasce de
-- `gen_random_uuid()`, entao conflito de chave primaria nunca acontece: o `on conflict` jamais
-- dispararia e uma segunda passada DUPLICARIA a linha — que e exatamente o estado que o indice
-- acima existe para impedir do lado do padrao.
insert into public.assistentes (workspace_id, nome_interno, nome, tratamento, sobre_o_negocio, padrao)
select c.workspace_id, 'Assistente', c.nome, c.tratamento, c.sobre_o_negocio, true
  from public.agente_config c
 where not exists (
   select 1 from public.assistentes a where a.workspace_id = c.workspace_id
 );

-- ── 4. Em qual canal cada assistente atende ────────────────────────────────────────────
--
-- Nulo significa "o padrao do espaco de trabalho", e NUNCA "sem assistente" — canal nenhum
-- fica mudo por falta de atribuicao. Quem decide se o assistente responde continua sendo
-- `canais.agente_ligado`, e atribuir um assistente a um canal nao liga nada.
alter table public.canais add column if not exists agente_id uuid;

-- 🔴 A CHAVE E COMPOSTA, e nao uma referencia so a `assistentes(id)`. A acao que atribui recebe
-- o canal E o assistente vindos do NAVEGADOR; o filtro de espaco de trabalho no codigo escopa
-- QUAL canal e atualizado, e nada ali confere que o assistente pertence aquele espaco. Chave
-- estrangeira de uma coluna so confere existencia. O desfecho seria o canal de um cliente
-- respondendo os clientes dele com o nome e a descricao do negocio de OUTRA empresa — e, com as
-- regras de linha FORA do caminho de escrita, a constraint e a unica barreira que sobrevive a
-- um descuido de codigo.
--
-- 🔴 A LISTA `(agente_id)` NO `on delete set null` NAO E OPCIONAL (PG15+). `workspace_id` e
-- `not null` e nao pode ir a nulo: sem a lista, o banco tentaria zerar AS DUAS colunas e
-- falharia no momento em que alguem apagasse um assistente — erro cru de Postgres na cara de
-- quem comprou, no meio de uma acao de rotina. Ha quatro precedentes com esta mesma forma no
-- repositorio.
--
-- MATCH SIMPLE (o padrao): com `agente_id` nulo a chave nao confere nada, que e o estado normal
-- de todo canal que nunca recebeu atribuicao.
--
-- Guardada por existencia porque o Postgres nao tem `add constraint if not exists`, e uma
-- segunda passada nao pode falhar.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'canais_agente_fk'
                   and conrelid = 'public.canais'::regclass) then
    alter table public.canais
      add constraint canais_agente_fk
      foreign key (workspace_id, agente_id)
      references public.assistentes (workspace_id, id)
      on delete set null (agente_id);
  end if;
end $$;

comment on column public.canais.agente_id is
  'Qual assistente responde neste canal. Nulo = o assistente padrao do espaco de trabalho.';
