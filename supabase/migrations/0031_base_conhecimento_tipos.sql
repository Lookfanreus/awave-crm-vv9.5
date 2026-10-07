-- 0031_base_conhecimento_tipos.sql
-- Duas correcoes na base de conhecimento: a busca passa a receber QUAIS tipos de entrada pode
-- devolver, e a lista de entradas sem vetor ganha o indice que a consulta de verdade usa.

-- O search_path desta SESSAO, para o tipo e o operador resolverem durante a aplicacao.
set local search_path = public, extensions;

-- ── 1. a busca por tipo ─────────────────────────────────────────────────────────────────────
--
-- O bloco de conhecimento que o assistente recebe em TODA rodada passa a carregar somente
-- `fato`. `playbook` e roteiro de atendimento — como responder, ate onde ceder, o que dizer
-- quando o cliente reclama — e ele so deve chegar ao modelo quando o proprio modelo o pedir,
-- pela ferramenta de consulta. Sem o filtro, o roteiro interno entrava em toda rodada.
--
-- O filtro mora AQUI, e nao no codigo que chama: descartar depois traria o roteiro pela rede
-- para joga-lo fora em seguida, que e o mesmo dado saindo do banco por um caminho que ninguem
-- confere.
--
-- `p_tipos` nulo devolve todos os tipos — e e assim que a ferramenta de consulta chama.
--
-- 🔴 `drop` + `create`, e nao `create or replace`: acrescentar um parametro cria uma funcao
-- NOVA em vez de substituir a antiga, e as duas conviveriam — a antiga sem o filtro, e ninguem
-- lembraria dela. O preco de dropar esta escrito: um aplicativo mais antigo que este banco
-- chama a versao de cinco parametros, nao a encontra, e a busca cai no estado "base
-- indisponivel", que aparece na caixa de entrada. E degradacao visivel, nao silencio.
--
-- ⚠️ E `drop` + `create` NAO preserva a lista de permissoes da funcao. Os dois blocos do fim
-- deste arquivo nao sao repeticao: sem eles a funcao nasce alcancavel de novo.
drop function if exists public.base_conhecimento_buscar(uuid, text, extensions.vector, text, int);

-- Busca hibrida: o braco textual e o semantico rankeiam em paralelo e se fundem por
-- 1/(k+posicao). Vetorial sozinha erra termo exato (um codigo, um CEP); textual sozinha erra
-- parafrase, que e como o cliente escreve.
--
-- `search_path = extensions` e obrigatorio: o operador `<=>` e o tipo `vector` vivem la, e
-- operador NAO se qualifica por prefixo. Vazio ou `public` quebraria toda a busca por
-- similaridade. `pg_catalog` e sempre pesquisado antes, e as tabelas vao qualificadas.
create function public.base_conhecimento_buscar(
  p_ws uuid,
  p_query text,
  p_embedding extensions.vector(1536),
  p_versao text,
  p_limite int,
  p_tipos text[]
) returns table (id uuid, titulo text, conteudo text, tipo text, score float)
language sql stable security definer set search_path = extensions as $$
with textual as (
  select b.id, row_number() over (
           order by ts_rank_cd(b.fts, websearch_to_tsquery('portuguese', p_query)) desc) as posicao
    from public.base_conhecimento b
   where b.workspace_id = p_ws and b.habilitado
     and (p_tipos is null or b.tipo = any(p_tipos))
     and b.fts @@ websearch_to_tsquery('portuguese', p_query)
   limit p_limite * 2
), semantico as (
  select b.id, row_number() over (order by b.embedding <=> p_embedding) as posicao
    from public.base_conhecimento b
   where b.workspace_id = p_ws and b.habilitado
     and (p_tipos is null or b.tipo = any(p_tipos))
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
revoke all on function public.base_conhecimento_buscar(uuid, text, extensions.vector, text, int, text[])
  from public, anon, authenticated;
grant execute on function public.base_conhecimento_buscar(uuid, text, extensions.vector, text, int, text[])
  to service_role;

-- ── 2. o indice das entradas sem vetor ──────────────────────────────────────────────────────
--
-- As duas consultas que procuram entrada pendente de vetor filtram por `embed_versao is null`;
-- o indice que existia filtrava por `embedding is null`. Os dois predicados descrevem as mesmas
-- linhas, mas o Postgres nao deriva um do outro — entao o indice antigo nunca era usado por
-- consulta nenhuma: ele custava escrita em toda gravacao e nao servia leitura nenhuma.
create index if not exists base_conhecimento_sem_versao_idx
  on public.base_conhecimento (workspace_id) where embed_versao is null;

drop index if exists public.base_conhecimento_sem_emb_idx;
