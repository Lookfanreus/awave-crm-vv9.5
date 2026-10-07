-- 0030_base_conhecimento.sql
-- O acervo que o assistente consulta para responder preco, prazo e politica. Sem ele, o
-- assistente e proibido de inventar e nao tem onde consultar — entao nao responde.

-- 🔴 RELOCA A EXTENSAO ANTES DE USA-LA. `create extension if not exists vector with schema
-- extensions` e NO-OP quando ela ja existe em OUTRO schema (`public` e onde projetos antigos a
-- colocaram) — e ai o tipo `extensions.vector(1536)` do `create table` abaixo nao resolve e a
-- migration morre, derrubando o boot de um CRM que talvez nunca tenha ligado o assistente.
--
-- E o pre-voo nao segura mais este caso de proposito: recusar o boot ali derrubava o produto
-- INTEIRO — relatorios, funil, kanban — por causa de um upsell opcional. Open-core: o nucleo
-- roda offline para sempre, so os extras gateiam. Ele so recusa quando a extensao e
-- INDISPONIVEL, que e o unico estado em que nao ha o que relocar.
--
-- O `alter` vai dentro de um bloco com `exception` porque ele exige ser DONO da extensao (no
-- Supabase ela costuma pertencer a outro papel quando foi habilitada pelo painel) e pode falhar
-- tambem por objeto dependente. Quando nao der, seguimos com um `warning` NOMEADO: o `create
-- extension` abaixo e no-op, o `create table` falha com o erro do Postgres, e o comprador tem a
-- receita na secao 8.5 do DEPLOY.md. Falhar com aviso e melhor que falhar duas linhas abaixo sem
-- nenhum — e o `warning` chega ao log do container porque o runner das migrations imprime
-- `NoticeResponse`.
--
-- O bloco e IDEMPOTENTE: extensao ja em `extensions` (o caso de toda instalacao nova, em que ela
-- nem existe ainda) nao entra no `if` e nao imprime nada.
--
-- ⚠️ CUSTO NOMEADO: extensao e recurso do BANCO INTEIRO, nao deste app. Mover a `vector` muda o
-- schema dela para tudo que compartilhar este projeto Supabase. E aceitavel porque no Supabase o
-- `search_path` dos papeis ja inclui `extensions`, entao referencia sem prefixo continua
-- resolvendo — e porque o DEPLOY.md pede um projeto dedicado ao CRM. O outro prato da balanca era
-- o CRM inteiro nao subir.
do $$
declare esquema text;
begin
  select n.nspname into esquema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'vector';
  if esquema is not null and esquema <> 'extensions' then
    begin
      execute 'alter extension vector set schema extensions';
      raise notice '[0030] extensao vector movida de % para extensions', esquema;
    exception when others then
      raise warning '[0030] nao foi possivel mover a extensao vector de % para extensions: %. Ver a secao 8.5 do DEPLOY.md.', esquema, sqlerrm;
    end;
  end if;
end $$;

-- O tipo `vector` e o operador `<=>` passam a viver em `extensions`. Neste ponto ou ela ja
-- existe no lugar certo (inclusive por causa do bloco acima) ou da para cria-la.
create extension if not exists vector with schema extensions;

-- O search_path desta SESSAO, para o tipo e a opclass resolverem durante a aplicacao.
set local search_path = public, extensions;

create table if not exists public.base_conhecimento (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  titulo       text not null,
  conteudo     text not null,
  tipo         text not null default 'fato' check (tipo in ('fato','playbook')),
  -- Toda entrada nasce `operador`: e o que a tela grava, e nada no aplicativo grava
  -- `aprendizado` hoje. O segundo valor esta no `check`, e a regra dele esta no gatilho mais
  -- abaixo, porque regra escrita depois de o dado existir chega tarde — mas ele nao descreve
  -- nada que o produto faca por enquanto.
  origem       text not null default 'operador' check (origem in ('operador','aprendizado')),
  habilitado   boolean not null default true,
  embedding    extensions.vector(1536),
  -- Carimbo `openai:<modelo>:<dimensao>`. O braco semantico so considera linhas cujo carimbo
  -- casa o modelo atual: comparar vetores de modelos diferentes devolve resultado sem sentido,
  -- e sem sentido em silencio e pior que sem resultado.
  embed_versao text,
  fts          tsvector generated always as
               (to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(conteudo,''))) stored,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists base_conhecimento_fts_idx
  on public.base_conhecimento using gin (fts);
create index if not exists base_conhecimento_emb_idx
  on public.base_conhecimento using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;
-- A tela precisa achar o que ficou sem vetor para oferecer o reprocessamento. Sem este indice
-- a entrada some do braco semantico para sempre e nada a lista.
create index if not exists base_conhecimento_sem_emb_idx
  on public.base_conhecimento (workspace_id) where embedding is null;
create index if not exists base_conhecimento_lista_idx
  on public.base_conhecimento (workspace_id, atualizado_em desc);

alter table public.base_conhecimento enable row level security;

-- LEITURA por membro do espaco de trabalho. Escrita nao tem policy: ela sai toda pelo cliente
-- de servico.
--
-- `to authenticated` nao e enfeite: omitir o `TO` em Postgres significa `TO PUBLIC`, que inclui
-- o papel `anon` — mais largo do que se pretende. Mesma forma da policy de leitura da
-- `0022_canais.sql`.
-- GUARDADA pelo `pg_policies`, como a 0028: o Postgres nao tem `create policy if not exists`,
-- e este arquivo abre com `create table if not exists`. Declarar tolerancia a tabela
-- pre-existente e emitir a policy nua logo abaixo faz a reexecucao morrer aqui com `42710` —
-- e migration que falha e container que NAO SOBE, em toda instalacao.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'base_conhecimento'
       and policyname = 'base_conhecimento_sel'
  ) then
    create policy base_conhecimento_sel on public.base_conhecimento
      for select to authenticated using (public.e_membro(workspace_id));
  end if;
end $$;

-- Entrada de origem `aprendizado` nasce DESLIGADA — e hoje nao existe quem a insira: a regra
-- vem ANTES do dado, de proposito, porque regra escrita depois de o dado existir chega tarde.
-- Levanta excecao em vez de corrigir em silencio: quem inserir precisa dizer
-- `habilitado => false` na propria chamada, e ai a regra fica visivel onde a decisao e tomada.
-- So no INSERT — ligar depois e decisao de uma pessoa.
create or replace function public.base_conhecimento_nascimento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.origem = 'aprendizado' and new.habilitado then
    raise exception 'entrada de origem aprendizado nasce desligada: informe habilitado => false';
  end if;
  return new;
end $$;

-- GUARDADO pelo `pg_trigger` — catalogo diferente do da policy, mesma razao. `create trigger`
-- nao aceita `if not exists`, e a funcao acima e `create or replace` (reexecutavel), entao sem
-- esta guarda o arquivo atravessaria a funcao e pararia no gatilho.
--
-- ⚠️ Com `tgrelid`, e nao so `tgname`: nome de gatilho e unico POR TABELA no Postgres, entao um
-- gatilho homonimo em OUTRA tabela faria esta guarda achar aquele, engolir a criacao, e o
-- gatilho daqui nunca existir — sem erro, com a migration registrada como aplicada.
--
-- (Uma versao anterior deste comentario dizia que "as guardas de constraint deste banco ja
-- qualificam pelo `conrelid`". Era FALSO quando foi escrito: nove guardas — quatro na 0025,
-- duas na 0028, uma na 0039, uma na 0041 e o gatilho da 0048 — sondavam so pelo nome, e duas
-- delas estavam no mesmo commit que escreveu esta frase. Foram todas qualificadas depois. O
-- que vale hoje: TODA guarda de catalogo deste diretorio nomeia a relacao, e ha teste de disco
-- cruzando as duas pontas.)
do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'base_conhecimento_nascimento_trg'
       and tgrelid = 'public.base_conhecimento'::regclass
  ) then
    create trigger base_conhecimento_nascimento_trg
      before insert on public.base_conhecimento
      for each row execute function public.base_conhecimento_nascimento();
  end if;
end $$;

-- Busca hibrida: o braco textual e o semantico rankeiam em paralelo e se fundem por
-- 1/(k+posicao). Vetorial sozinha erra termo exato (um codigo, um CEP); textual sozinha erra
-- parafrase, que e como o cliente escreve.
--
-- `search_path = extensions` e obrigatorio: o operador `<=>` e o tipo `vector` vivem la, e
-- operador NAO se qualifica por prefixo. Vazio ou `public` quebraria toda a busca por
-- similaridade. `pg_catalog` e sempre pesquisado antes, e as tabelas vao qualificadas.
create or replace function public.base_conhecimento_buscar(
  p_ws uuid,
  p_query text,
  p_embedding extensions.vector(1536),
  p_versao text,
  p_limite int
) returns table (id uuid, titulo text, conteudo text, tipo text, score float)
language sql stable security definer set search_path = extensions as $$
with textual as (
  select b.id, row_number() over (
           order by ts_rank_cd(b.fts, websearch_to_tsquery('portuguese', p_query)) desc) as posicao
    from public.base_conhecimento b
   where b.workspace_id = p_ws and b.habilitado
     and b.fts @@ websearch_to_tsquery('portuguese', p_query)
   limit p_limite * 2
), semantico as (
  select b.id, row_number() over (order by b.embedding <=> p_embedding) as posicao
    from public.base_conhecimento b
   where b.workspace_id = p_ws and b.habilitado
     and p_embedding is not null
     and b.embedding is not null
     and b.embed_versao = p_versao
   order by b.embedding <=> p_embedding
   limit p_limite * 2
)
select b.id, b.titulo, b.conteudo, b.tipo,
       (coalesce(1.0 / (60 + textual.posicao), 0.0)
      + coalesce(1.0 / (60 + semantico.posicao), 0.0))::float as score
  from public.base_conhecimento b
  left join textual on textual.id = b.id
  left join semantico on semantico.id = b.id
 where textual.id is not null or semantico.id is not null
 order by score desc
 limit p_limite;
$$;

-- REVOGA de `authenticated` tambem, e nao so de public/anon. No Supabase o
-- `alter default privileges` concede EXECUTE a `authenticated` na CRIACAO da funcao, entao
-- revogar de public/anon NAO tira esse grant. As funcoes sao `security definer`: rodam como
-- donas e NAO consultam policy nenhuma. Sem estas linhas, qualquer autenticado de qualquer
-- espaco de trabalho chamaria a funcao e leria a base de outro.
revoke all on function public.base_conhecimento_buscar(uuid, text, extensions.vector, text, int)
  from public, anon, authenticated;
grant execute on function public.base_conhecimento_buscar(uuid, text, extensions.vector, text, int)
  to service_role;
revoke all on function public.base_conhecimento_nascimento() from public, anon, authenticated;
grant execute on function public.base_conhecimento_nascimento() to service_role;
