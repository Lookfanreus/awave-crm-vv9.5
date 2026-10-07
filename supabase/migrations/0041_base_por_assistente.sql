-- 0041_base_por_assistente.sql — a base de conhecimento passa a poder ser recortada por
-- assistente, em vez de responder sempre pelo espaco de trabalho inteiro.
--
-- ⚠️ ADITIVA: uma tabela nova, um indice novo, e a busca ganha um parametro com DEFAULT NULL.
-- Nenhuma coluna sai, nenhuma linha muda de valor, nenhuma chamada existente para de
-- funcionar. Migration que falha e container que NAO SOBE, em toda instalacao.
--
-- Ausencia de linha para um bloco continua significando "vale para TODOS os assistentes" — o
-- comportamento de hoje, preservado. Uma ou mais linhas restringem o bloco aos assistentes
-- listados.

-- O search_path desta SESSAO, para o tipo e o operador da busca resolverem durante a
-- aplicacao.
set local search_path = public, extensions;

-- ── 1. o unico que a chave estrangeira composta exige ──────────────────────────────────
--
-- `assistentes` ja tem `unique (workspace_id, id)` (0039); `base_conhecimento` (0030) so
-- declara `id uuid primary key` e `workspace_id` solto — sem UNIQUE sobre o par. Sem ele, a
-- chave estrangeira composta do bloco abaixo levanta "there is no unique constraint matching
-- given keys", e migration que falha e container que nao sobe, em toda instalacao.
--
-- Guardada por existencia porque o Postgres nao tem `add constraint if not exists`, e uma
-- segunda passada nao pode falhar.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'base_conhecimento_ws_id_key'
                   and conrelid = 'public.base_conhecimento'::regclass) then
    alter table public.base_conhecimento
      add constraint base_conhecimento_ws_id_key unique (workspace_id, id);
  end if;
end $$;

-- ── 2. a juncao: qual bloco pertence a qual assistente ──────────────────────────────────
create table if not exists public.assistente_blocos (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assistente_id uuid not null,
  bloco_id uuid not null,
  criado_em timestamptz not null default now(),
  -- A ordem e o que torna o indice abaixo NECESSARIO: o filtro da busca procura por bloco, que
  -- nao e coluna-lider aqui. Invertida, o indice seria redundante e so custaria escrita.
  primary key (workspace_id, assistente_id, bloco_id),
  -- 🔴 COMPOSTAS NOS DOIS LADOS: a escrita sai toda pelo service-role, que nao avalia policy,
  -- entao a constraint e a unica barreira que sobra contra amarrar o bloco de um inquilino ao
  -- assistente de outro.
  foreign key (workspace_id, assistente_id)
    references public.assistentes (workspace_id, id) on delete cascade,
  foreign key (workspace_id, bloco_id)
    references public.base_conhecimento (workspace_id, id) on delete cascade
);

alter table public.assistente_blocos enable row level security;

-- GUARDADAS pelo `pg_policies`, como a 0028: o Postgres nao tem `create policy if not exists`,
-- e este arquivo abre com `create table if not exists`. Tolerancia declarada em cima e DDL nu
-- embaixo e meia-idempotencia — a reexecucao passa pela tabela e morre aqui, com `42710`, e
-- migration que falha e container que NAO SOBE.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'assistente_blocos'
       and policyname = 'assistente_blocos_service'
  ) then
    create policy assistente_blocos_service on public.assistente_blocos
      for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'assistente_blocos'
       and policyname = 'assistente_blocos_membro'
  ) then
    create policy assistente_blocos_membro on public.assistente_blocos
      for select to authenticated using (public.e_membro(workspace_id));
  end if;
end $$;

-- ── 3. o indice ──────────────────────────────────────────────────────────────────────────
--
-- A chave primaria lidera por workspace_id, assistente_id, bloco_id — e a busca filtra por
-- bloco. Sem indice proprio nesta ordem, "quais assistentes este bloco atende" varre a tabela
-- inteira a cada chamada da RPC.
create index if not exists assistente_blocos_bloco_idx
  on public.assistente_blocos (workspace_id, bloco_id);

-- ── 4. a busca aplica o recorte ────────────────────────────────────────────────────────────
--
-- 🔴 `drop` + `create`, e nao `create or replace`: acrescentar um parametro cria uma funcao
-- NOVA em vez de substituir a antiga, e as duas conviveriam — a antiga sem o recorte, e
-- ninguem lembraria dela. O `drop` garante que so exista UMA funcao candidata para o
-- PostgREST resolver.
--
-- ⚠️ DIFERENTE DA `0031` (la `p_tipos` chegou SEM default, e por isso a chamada de cinco
-- parametros realmente parava de resolver depois do drop): aqui `p_assistente` tem
-- `default null` — ver o comentario dele mais abaixo —, entao a chamada antiga de seis
-- parametros CONTINUA resolvendo depois deste drop+create. O que deixa de valer e o recorte
-- (quem nao manda o parametro volta a ver a base inteira), nao a busca em si.
--
-- ⚠️ E `drop` + `create` NAO preserva a lista de permissoes da funcao. Os dois blocos do fim
-- deste arquivo nao sao repeticao: sem eles a funcao nasce alcancavel de novo.
drop function if exists public.base_conhecimento_buscar(
  uuid, text, extensions.vector, text, int, text[]
);

-- Busca hibrida: o braco textual e o semantico rankeiam em paralelo e se fundem por
-- 1/(k+posicao). Vetorial sozinha erra termo exato (um codigo, um CEP); textual sozinha erra
-- parafrase, que e como o cliente escreve.
--
-- `search_path = extensions` e obrigatorio: o operador `<=>` e o tipo `vector` vivem la, e
-- operador NAO se qualifica por prefixo. Vazio ou `public` quebraria toda a busca por
-- similaridade. `pg_catalog` e sempre pesquisado antes, e as tabelas vao qualificadas.
--
-- ⚠️ `p_assistente` leva DEFAULT NULL: sem ele, as chamadas nomeadas que ja existem no codigo
-- (que nao mandam este parametro) deixariam de resolver no PostgREST. E `null` significa
-- "sem recorte, ve tudo" — nunca "nenhum assistente".
create function public.base_conhecimento_buscar(
  p_ws uuid,
  p_query text,
  p_embedding extensions.vector(1536),
  p_versao text,
  p_limite int,
  p_tipos text[],
  p_assistente uuid default null
) returns table (id uuid, titulo text, conteudo text, tipo text, score float)
language sql stable security definer set search_path = extensions as $$
with textual as (
  select b.id, row_number() over (
           order by ts_rank_cd(b.fts, websearch_to_tsquery('portuguese', p_query)) desc) as posicao
    from public.base_conhecimento b
   where b.workspace_id = p_ws and b.habilitado
     and (p_tipos is null or b.tipo = any(p_tipos))
     and coalesce(
           (select bool_or(ab.assistente_id = p_assistente)
              from public.assistente_blocos ab
             where ab.bloco_id = b.id and ab.workspace_id = b.workspace_id),
           true)
     and b.fts @@ websearch_to_tsquery('portuguese', p_query)
   limit p_limite * 2
), semantico as (
  select b.id, row_number() over (order by b.embedding <=> p_embedding) as posicao
    from public.base_conhecimento b
   where b.workspace_id = p_ws and b.habilitado
     and (p_tipos is null or b.tipo = any(p_tipos))
     and coalesce(
           (select bool_or(ab.assistente_id = p_assistente)
              from public.assistente_blocos ab
             where ab.bloco_id = b.id and ab.workspace_id = b.workspace_id),
           true)
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
-- revogar de public/anon NAO tira esse grant. A funcao e `security definer`: roda como dona e
-- NAO consulta policy nenhuma. Sem estas linhas, qualquer autenticado de qualquer espaco de
-- trabalho chamaria a funcao e leria a base de outro.
revoke all on function public.base_conhecimento_buscar(
  uuid, text, extensions.vector, text, int, text[], uuid
) from public, anon, authenticated;
grant execute on function public.base_conhecimento_buscar(
  uuid, text, extensions.vector, text, int, text[], uuid
) to service_role;
