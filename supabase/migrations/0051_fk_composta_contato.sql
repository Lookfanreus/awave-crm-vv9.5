-- 0051_fk_composta_contato.sql — a terceira FK de `conversas` passa a carregar o workspace.
--
-- ⚠️ ADITIVA. Migration que falha = container que NAO SOBE, em toda instalacao. Nada aqui
-- exige ownership de tabela do Supabase e nada aqui apaga dado: a constraint trocada e MAIS
-- estrita, e as linhas que existem hoje ja a satisfazem (o codigo sempre escreveu o workspace
-- certo — `resolverContato` filtra por workspace). Se alguma nao satisfizesse, o `alter table`
-- recusaria e a instalacao pararia; e por isso o par (workspace_id, contato_id) e conferido
-- pelo proprio banco na hora, exatamente como a 0025 argumenta.
--
-- 🔴 O QUE ISTO CONSERTA. A doutrina da 0025 — "com a RLS FORA do caminho de escrita (0021),
-- a chave estrangeira composta e a unica barreira que sobrevive a um descuido de codigo" — foi
-- aplicada a DUAS das TRES colunas de `conversas` que apontam para fora. `atribuida_a` nasceu
-- composta na 0022, `negocio_id` virou composta na 0023, `canal_id` virou composta na 0025 —
-- e `contato_id` ficou como `references public.contatos(id)`, FK de uma coluna so.
--
-- Ela nao ficou de fora por decisao: nao dava para converte-la sem antes criar o alvo.
-- `contatos` e a unica tabela do nucleo que NUNCA ganhou `unique (workspace_id, id)` — a 0011
-- criou para `pipelines`, `etapas` e `negocios`, a 0004 para `membros`, a 0009 para
-- `tipos_atividade`, a 0041 para `base_conhecimento`.
--
-- O que a coluna decide: `contato_id` e o NOME exibido na caixa de entrada, o titulo do
-- negocio criado a partir da conversa e o contato do cartao no funil. Um caminho futuro de
-- escrita (unificar LID com numero, uma correcao em massa, uma importacao que religa conversas
-- a contatos) que passe um `contato_id` vindo de outra consulta sem filtro de workspace e
-- aceito pelo banco hoje, e `garantirConversa` nao confere nada.
--
-- ── O CUSTO, ESCRITO, porque ele nao e zero ────────────────────────────────────────────────
--
-- 🔴 O indice unico novo e construido NO BOOT, sem `CONCURRENTLY`. Nao ha escolha: o
-- `migrate.mjs` embrulha cada arquivo numa transacao e e hash-gated, e `CREATE INDEX
-- CONCURRENTLY` nao roda dentro de transacao. `contatos` e a maior tabela do CRM de um
-- comprador, e enquanto a construcao acontece o container ANTIGO ainda atende.
--
-- ⚠️ E a frase facil sobre isso e ERRADA: `ADD CONSTRAINT` toma `ACCESS EXCLUSIVE` de qualquer
-- jeito. O que se compra evitando a validacao (`not valid`) e a VARREDURA, nunca a trava. Aqui
-- nem isso esta em jogo no alvo: `id` ja e chave primaria, entao o par (workspace_id, id) nao
-- pode ter duplicata e a construcao e um sort, nao uma checagem que possa falhar.
--
-- As ordens de grandeza abaixo sao ARITMETICA, nao medicao: nenhum banco com base grande foi
-- medido. A entrada do indice sao dois uuid mais o cabecalho de
-- tupla, ~48 bytes com folga de pagina. 10 mil contatos ~= 0,5 MB e a construcao e
-- imperceptivel; 100 mil ~= 5 MB e menos de um segundo; 1 milhao ~= 50 MB e alguns segundos de
-- `ACCESS EXCLUSIVE`. O teto da faixa gratuita do Supabase e 500 MB.
--
-- 📌 E ele e o QUARTO indice criado sobre `contatos` no mesmo boot da release que levar esta
-- branch: a 0022, a 0036 e a 0038 criam os outros tres, e todos pelo mesmo caminho sem
-- `CONCURRENTLY`. Quem tiver base grande deve subir a versao em janela de baixa movimentacao —
-- o custo marginal DESTE arquivo e um quarto passo num boot que ja faz tres.
--
-- A FK, do outro lado, e barata: a validacao varre `conversas` (limitada por conversa, nao por
-- contato) fazendo consulta de indice em `contatos`. Ela e VALIDADA de proposito, como as
-- quatro compostas anteriores — uma FK `not valid` deixaria as linhas de hoje sem conferencia
-- para sempre, e numa constraint de ISOLAMENTO isso e o contrario do que ela existe para
-- fazer.
--
-- MATCH SIMPLE (o default): com `contato_id` nulo a FK nao checa nada, que e o estado normal
-- de toda conversa antes de o contato ser resolvido.

-- ── o alvo ─────────────────────────────────────────────────────────────────────────────
--
-- FK composta precisa de um unico sobre EXATAMENTE as colunas referenciadas. E constraint (e
-- nao `create unique index`) para seguir o precedente da 0004 e da 0025. `id` ja e chave
-- primaria, entao esta linha NAO PODE falhar por dado existente.
--
-- 🔴 GUARDADA pelo `pg_constraint` COM `conrelid`. `add constraint` nao aceita `if not
-- exists`, e `conname` e unico por TABELA: uma guarda que sonde so o nome pode achar a
-- constraint homonima de outra tabela, engolir o `add` daqui, e o objeto nunca existir — sem
-- erro, com a migration registrada como aplicada.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contatos_ws_id_key'
                   and conrelid = 'public.contatos'::regclass) then
    alter table public.contatos add constraint contatos_ws_id_key unique (workspace_id, id);
  end if;
end $$;

-- ── conversas.contato_id ───────────────────────────────────────────────────────────────
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
     and a.attname  = 'contato_id'
     and not a.attisdropped;
  if n is null then
    raise exception '[0051] coluna public.conversas.contato_id nao encontrada';
  end if;

  for c in
    select conname from pg_constraint
     where conrelid = 'public.conversas'::regclass
       and contype = 'f'
       and confrelid = 'public.contatos'::regclass
       and conkey = array[n]::smallint[]
  loop
    execute format('alter table public.conversas drop constraint %I', c.conname);
  end loop;

  -- 🔴 SET NULL so na COLUNA (PG15+), exatamente como a 0004, a 0022 e a 0023: `workspace_id`
  -- e NOT NULL e nao pode ir a null. Um `on delete set null` sem a lista de colunas tentaria
  -- zerar as duas — passa na migration, passa no `alter table`, e estoura em RUNTIME no
  -- primeiro `delete` de contato, na cara de quem comprou.
  if not exists (select 1 from pg_constraint where conname = 'conversas_contato_fk'
                   and conrelid = 'public.conversas'::regclass) then
    alter table public.conversas
      add constraint conversas_contato_fk
      foreign key (workspace_id, contato_id)
      references public.contatos (workspace_id, id) on delete set null (contato_id);
  end if;
end $$;

comment on constraint conversas_contato_fk on public.conversas is
  'A conversa so aponta para contato do PROPRIO espaco de trabalho. Depois da 0021 a escrita sai toda pelo service-role e a RLS nao e avaliada: esta constraint e a barreira que sobrevive a um descuido de codigo.';
