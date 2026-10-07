-- 0034_rejeicoes_por_motivo.sql — o contador de eventos rejeitados do canal passa a ter DOIS
-- motivos, cada um na sua coluna.
--
-- ⚠️ ADITIVA. Coluna nova com default e funcao nova: nenhuma linha muda, nenhuma coluna some,
-- nenhum dominio se estreita. Migration que falha = container que NAO SOBE, em toda
-- instalacao: o EasyPanel mantem a versao anterior servindo e o comprador fica sem entender
-- por que a atualizacao "nao pegou".
--
-- 🔴 POR QUE DOIS CONTADORES E NAO UM MAIOR: os dois motivos pedem do comprador acoes
-- OPOSTAS. "A chave de assinatura nao confere" manda reconferir a chave no painel do provider;
-- "chegou evento de um numero que nao e o deste canal" manda conferir qual numero esta ligado
-- a qual canal. Um `int` unico soma as duas coisas, e a tela deixa de conseguir dizer qualquer
-- uma delas — que e exatamente o que o contador existe para dizer.

-- ── a coluna ───────────────────────────────────────────────────────────────────────────
--
-- Eventos recusados pela conferencia de ASSINATURA do corpo: a chave configurada no canal nao
-- confere com o que veio no cabecalho. A coluna irma, `eventos_rejeitados`, continua sendo a
-- do OUTRO motivo — o corpo esta assinado, mas fala de uma instancia que nao e a deste canal.
--
-- `not null default 0` porque "sem contagem ainda" e zero, nao nulo: um `coalesce` esquecido
-- de quem for ler renderiza "N eventos" com N vazio.
--
-- ⚠️ HOJE NINGUEM LE ESTA COLUNA. O painel seleciona so `eventos_rejeitados`; distinguir os
-- dois motivos na tela e trabalho de outra fatia. Registrar antes de mostrar e deliberado —
-- contagem que so passa a existir junto com a tela nasce zerada, e nao ajuda no primeiro
-- chamado de suporte, que e exatamente quando ela vale.
--
-- ⚠️ E `rejeitado_em` (0022) passa a ser compartilhada pelos dois contadores: ela responde
-- "quando foi a ultima rejeicao", nao "de qual motivo". Quem for mostrar os dois separados
-- precisa decidir se isso basta.
alter table public.canais
  add column if not exists eventos_rejeitados_assinatura integer not null default 0;

-- ── o incremento ───────────────────────────────────────────────────────────────────────
--
-- 🔴 FUNCAO NOVA, COM NOME PROPRIO — nunca um `create or replace` da irma com um parametro a
-- mais. No Postgres, mudar a lista de argumentos CRIA UMA SOBRECARGA em vez de substituir:
-- passariam a existir duas funcoes de mesmo nome, e uma chamada com numero de argumentos
-- ambiguo vira erro em runtime, no banco de quem comprou. Nome proprio custa uma linha e nao
-- tem esse modo de falha.
--
-- O resto e o molde exato de `incrementar_rejeicoes_canal`, e cada peca pelo mesmo motivo:
-- e RPC porque contador lido-e-escrito em duas viagens perde evento justamente quando ha
-- muitos deles, que e o unico momento em que alguem olha para ele; `security definer` porque
-- quem chama e a rota de ingresso, que nao tem sessao; `set search_path = ''` para o nome da
-- tabela nao ser resolvido pelo caminho de quem chama.
create or replace function public.incrementar_rejeicoes_assinatura(p_ws uuid, p_canal uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.canais c
     set eventos_rejeitados_assinatura = c.eventos_rejeitados_assinatura + 1,
         rejeitado_em = now()
   where c.workspace_id = p_ws and c.id = p_canal;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de public/anon. No Supabase, ALTER DEFAULT
-- PRIVILEGES concede EXECUTE a `authenticated` na CRIACAO da funcao, entao revogar de
-- public/anon NAO tira esse grant. Sem estas duas linhas, qualquer autenticado de qualquer
-- espaco de trabalho poderia chamar esta funcao — e `security definer` nao consulta policy
-- nenhuma, entao daria para inflar o contador de outro espaco passando um uuid adivinhado.
--
-- ⚠️ E o `p_ws` do `where` nao e decorativo, pela mesma razao: rodando como dona da funcao, a
-- RLS nao e avaliada. O `id` ja e chave primaria, e e por isso que a checagem parece
-- redundante e nao e.
revoke all on function public.incrementar_rejeicoes_assinatura(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.incrementar_rejeicoes_assinatura(uuid, uuid) to service_role;
