-- 0025_fks_compostas_canais.sql — as FKs de mensageria passam a carregar o workspace.
--
-- ⚠️ ADITIVA. Migration que falha = container que NAO SOBE, em toda instalacao. Nada aqui
-- exige ownership de tabela do Supabase, e nada aqui apaga dado: as constraints trocadas sao
-- MAIS estritas, e as linhas que existem hoje ja as satisfazem (o codigo sempre escreveu o
-- workspace certo). Se alguma nao satisfizesse, o `alter table` recusaria e a instalacao
-- pararia — e por isso o par (workspace_id, alvo) e conferido pelo proprio banco na hora.
--
-- 🔴 O QUE ISTO CONSERTA. A 0022 argumenta DUAS VEZES pela FK composta — no comentario de
-- `conversas.atribuida_a` ("FK simples para membros(id) deixaria atribuir conversa a membro de
-- OUTRO workspace") — e mesmo assim deixou `conversas.canal_id` e `mensagens.conversa_id` como
-- FK simples. O mesmo argumento vale para as duas, e no `canal_id` ele PESA MAIS: e o canal que
-- decide `canais.config.server_url`, que e a allowlist do download de midia. Uma conversa
-- apontando para canal de outro tenant faria o dreno baixar do servidor daquele outro tenant.
--
-- Nao e alcancavel hoje: toda escrita passa por codigo que filtra por workspace. E essa e
-- exatamente a razao de existir — com a RLS FORA do caminho de escrita (as policies da 0022
-- sao `for select`; quem escreve e o service_role), a constraint e a unica barreira que
-- sobrevive a um descuido de codigo. MATCH SIMPLE nao entra na conversa aqui: as duas colunas
-- referenciadoras sao `not null`, entao a checagem sempre roda.

-- ── os alvos ───────────────────────────────────────────────────────────────────────────
--
-- FK composta precisa de um unico sobre EXATAMENTE as colunas referenciadas. Sao constraints
-- (e nao `create unique index`) para seguir o precedente da 0004, que criou `unique
-- (workspace_id, id)` em `membros` com o comentario "alvo da FK composta de
-- negocios.responsavel_id". `id` ja e chave primaria, entao o par nunca pode ter duplicata e
-- estas duas linhas NAO PODEM falhar por dado existente.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'canais_ws_id_key'
                   and conrelid = 'public.canais'::regclass) then
    alter table public.canais add constraint canais_ws_id_key unique (workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'conversas_ws_id_key'
                   and conrelid = 'public.conversas'::regclass) then
    alter table public.conversas add constraint conversas_ws_id_key unique (workspace_id, id);
  end if;
end $$;

-- ── conversas.canal_id ─────────────────────────────────────────────────────────────────
--
-- 🔴 O LACO SO DERRUBA A FK DAQUELA COLUNA, e o discriminante e a COLUNA — nunca o par de
-- tabelas. `conkey` e o vetor de colunas da constraint: exigir que ele seja exatamente
-- `[attnum]` pega a FK de uma coluna so SOBRE A COLUNA ALVO, e ignora as das outras colunas
-- que apontem para a mesma tabela. O `attnum` sai do `pg_attribute`.
--
-- Ele comecou so com `cardinality(conkey) = 1`, que diz "e de uma coluna so" e NAO diz QUAL.
-- Isso alcancava a zona de customizacao — `custom/migrations/` (faixa 9000+) e ponto de
-- extensao documentado e ENTREGUE, e e justamente o que sobrevive a toda atualizacao. Uma FK
-- que o comprador criasse ali entre estas MESMAS duas tabelas, sobre uma coluna DELE, caia no
-- laco: derrubada na release seguinte, sem erro, sem log e sem voltar. E o mesmo defeito que a
-- 0027 fechou para `check`, um `contype` adiante.
--
-- 🔴 O NOME NAO ENTRA NO FILTRO, DE PROPOSITO — e e por isso que a FORMA precisa entrar. A FK
-- que este arquivo substitui nasce inline no `create table` da 0022 (`<coluna> uuid ...
-- references public.<alvo>(id) ...`), e o Postgres a batiza de `<tabela>_<coluna>_fkey`. Isso
-- e convencao do gerador, nao contrato: um banco vindo de restore, de um `pg_dump` antigo ou
-- de um `create table` editado a mao pode ter outro nome, e `drop constraint <nome errado>`
-- derruba o boot de quem ja pagou. O que NAO muda em nenhuma dessas historias e a forma — uma
-- coluna so, e essa coluna e a alvo —, entao o discriminante estrutural identifica a nossa sem
-- depender do nome. E o laco torna o arquivo re-executavel: o boot reaplica migration pendente.
--
-- ⚠️ E SER ESTRITO DEMAIS AQUI NAO E MUDO, ao contrario do laco de `check` da 0027. La o nome
-- que o `add` guarda esta dentro do conjunto que o laco derruba, entao um laco que nao casa
-- nada faz a guarda engolir a criacao e a coluna fica SEM a constraint. Aqui o `add` cria uma
-- FK de DUAS colunas, com nome proprio, que este laco nunca pode derrubar (o `conkey` dela tem
-- dois elementos): se o laco nao achar nada, a composta e criada do mesmo jeito, e o pior
-- desfecho e a FK simples antiga sobrar ao lado — redundante, porque a composta e estritamente
-- mais estrita, nunca ausente.
--
-- ⚠️ RESIDUO CONHECIDO, e ele e estreito: uma FK que o comprador crie sobre a PROPRIA coluna do
-- produto, apontando para a mesma tabela, ainda e derrubada. Nao ha o que distinguir — mesma
-- coluna, mesma tabela, mesma referencia; so a acao de `on delete` poderia diferir, e duas FKs
-- com acoes diferentes sobre a mesma coluna ja sao uma configuracao que se contradiz. A coluna
-- e do produto, e o guia entregue manda o comprador apontar a partir da tabela DELE.
do $$
declare
  c record;
  n smallint;
begin
  -- Sem `into strict`: coluna ausente deixa `n` nulo em vez de levantar, e a mensagem abaixo
  -- diz QUAL coluna sumiu. Um erro de catalogo cru nao diria.
  select a.attnum into n
    from pg_attribute a
   where a.attrelid = 'public.conversas'::regclass
     and a.attname  = 'canal_id'
     and not a.attisdropped;
  if n is null then
    raise exception '[0025] coluna public.conversas.canal_id nao encontrada';
  end if;

  for c in
    select conname from pg_constraint
     where conrelid = 'public.conversas'::regclass
       and contype = 'f'
       and confrelid = 'public.canais'::regclass
       and conkey = array[n]::smallint[]
  loop
    execute format('alter table public.conversas drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'conversas_canal_fk'
                   and conrelid = 'public.conversas'::regclass) then
    alter table public.conversas
      add constraint conversas_canal_fk
      foreign key (workspace_id, canal_id)
      references public.canais (workspace_id, id) on delete cascade;
  end if;
end $$;

-- ── mensagens.conversa_id ──────────────────────────────────────────────────────────────
--
-- Mesma regra, um degrau abaixo: mensagem so pode pertencer a conversa DO PROPRIO workspace.
-- Sem isto, uma linha de `mensagens` com o workspace de A e a conversa de B seria aceita pelo
-- banco — e a leitura da thread, que filtra por `workspace_id` E por `conversa_id`, mostraria
-- a mensagem de A dentro da conversa de B para quem tem acesso aos dois.
--
-- O molde do laco e o mesmo de `conversas.canal_id`, la em cima, e ele e IDENTICO de
-- proposito: os dois lacos fazem a mesma pergunta ao catalogo, com outros tres nomes. Uma
-- divergencia entre eles seria a forma mais barata de um deles passar a proteger menos que
-- o outro sem ninguem notar.
--
-- 🔴 O LACO SO DERRUBA A FK DAQUELA COLUNA, e o discriminante e a COLUNA — nunca o par de
-- tabelas. `conkey` e o vetor de colunas da constraint: exigir que ele seja exatamente
-- `[attnum]` pega a FK de uma coluna so SOBRE A COLUNA ALVO, e ignora as das outras colunas
-- que apontem para a mesma tabela. O `attnum` sai do `pg_attribute`.
--
-- Ele comecou so com `cardinality(conkey) = 1`, que diz "e de uma coluna so" e NAO diz QUAL.
-- Isso alcancava a zona de customizacao — `custom/migrations/` (faixa 9000+) e ponto de
-- extensao documentado e ENTREGUE, e e justamente o que sobrevive a toda atualizacao. Uma FK
-- que o comprador criasse ali entre estas MESMAS duas tabelas, sobre uma coluna DELE, caia no
-- laco: derrubada na release seguinte, sem erro, sem log e sem voltar. E o mesmo defeito que a
-- 0027 fechou para `check`, um `contype` adiante.
--
-- 🔴 O NOME NAO ENTRA NO FILTRO, DE PROPOSITO — e e por isso que a FORMA precisa entrar. A FK
-- que este arquivo substitui nasce inline no `create table` da 0022 (`<coluna> uuid ...
-- references public.<alvo>(id) ...`), e o Postgres a batiza de `<tabela>_<coluna>_fkey`. Isso
-- e convencao do gerador, nao contrato: um banco vindo de restore, de um `pg_dump` antigo ou
-- de um `create table` editado a mao pode ter outro nome, e `drop constraint <nome errado>`
-- derruba o boot de quem ja pagou. O que NAO muda em nenhuma dessas historias e a forma — uma
-- coluna so, e essa coluna e a alvo —, entao o discriminante estrutural identifica a nossa sem
-- depender do nome. E o laco torna o arquivo re-executavel: o boot reaplica migration pendente.
--
-- ⚠️ E SER ESTRITO DEMAIS AQUI NAO E MUDO, ao contrario do laco de `check` da 0027. La o nome
-- que o `add` guarda esta dentro do conjunto que o laco derruba, entao um laco que nao casa
-- nada faz a guarda engolir a criacao e a coluna fica SEM a constraint. Aqui o `add` cria uma
-- FK de DUAS colunas, com nome proprio, que este laco nunca pode derrubar (o `conkey` dela tem
-- dois elementos): se o laco nao achar nada, a composta e criada do mesmo jeito, e o pior
-- desfecho e a FK simples antiga sobrar ao lado — redundante, porque a composta e estritamente
-- mais estrita, nunca ausente.
--
-- ⚠️ RESIDUO CONHECIDO, e ele e estreito: uma FK que o comprador crie sobre a PROPRIA coluna do
-- produto, apontando para a mesma tabela, ainda e derrubada. Nao ha o que distinguir — mesma
-- coluna, mesma tabela, mesma referencia; so a acao de `on delete` poderia diferir, e duas FKs
-- com acoes diferentes sobre a mesma coluna ja sao uma configuracao que se contradiz. A coluna
-- e do produto, e o guia entregue manda o comprador apontar a partir da tabela DELE.
do $$
declare
  c record;
  n smallint;
begin
  -- Sem `into strict`: coluna ausente deixa `n` nulo em vez de levantar, e a mensagem abaixo
  -- diz QUAL coluna sumiu. Um erro de catalogo cru nao diria.
  select a.attnum into n
    from pg_attribute a
   where a.attrelid = 'public.mensagens'::regclass
     and a.attname  = 'conversa_id'
     and not a.attisdropped;
  if n is null then
    raise exception '[0025] coluna public.mensagens.conversa_id nao encontrada';
  end if;

  for c in
    select conname from pg_constraint
     where conrelid = 'public.mensagens'::regclass
       and contype = 'f'
       and confrelid = 'public.conversas'::regclass
       and conkey = array[n]::smallint[]
  loop
    execute format('alter table public.mensagens drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'mensagens_conversa_fk'
                   and conrelid = 'public.mensagens'::regclass) then
    alter table public.mensagens
      add constraint mensagens_conversa_fk
      foreign key (workspace_id, conversa_id)
      references public.conversas (workspace_id, id) on delete cascade;
  end if;
end $$;
