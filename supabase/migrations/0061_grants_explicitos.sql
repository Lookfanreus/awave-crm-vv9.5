-- 0061_grants_explicitos.sql — o CRM deixa de depender de um privilégio que ele nunca concedeu.
--
-- ═══ O QUE QUEBRAVA ═══════════════════════════════════════════════════════════════════════
--
-- Até aqui, NENHUMA migration concedia privilégio em TABELA. O produto funcionava porque o
-- Supabase concede por conta própria: todo projeto nasce com `alter default privileges` no
-- schema `public` para `anon`, `authenticated` e `service_role`, e as tabelas que as migrations
-- criam herdam isso.
--
-- 🔴 ESSA HERANÇA MORRE COM O SCHEMA. `drop schema public cascade` leva junto as entradas de
-- `pg_default_acl` daquele schema, e `create schema public` NÃO as recria. Quem reinstala o CRM
-- reusando o projeto Supabase — apagando o schema em vez de criar um projeto novo — fica com um
-- banco em que as tabelas nascem SEM privilégio nenhum.
--
-- Medido em 2026-09-05, num projeto real, comparando os dois caminhos:
--
--                                  projeto novo    schema recriado
--   privilégios em `membros`        3 papéis            NENHUM
--   tabelas com grant p/ authenticated   245                 0
--   `USAGE` no schema public             sim                 não
--
-- O sintoma é `SQLSTATE 42501 permission denied for table membros` no `/painel`, logo depois de
-- um login que funciona — o comprador entra e não tem produto. Relatado na comunidade, e o autor
-- chegou sozinho à causa: "não basta apagar o banco, e sim o projeto".
--
-- ⚠️ ELE NÃO É O ÚNICO CAMINHO. Vale para qualquer coisa que recrie o schema: um `pg_restore`
-- parcial, uma ferramenta de migração, um roteiro de "resetar o banco" copiado da internet. O
-- produto não tem como saber que isso aconteceu — ele só descobre quando a primeira consulta
-- falha, na cara de quem acabou de instalar.
--
-- ═══ POR QUE CONCEDER O MESMO QUE O SUPABASE, E NÃO O MÍNIMO ══════════════════════════════
--
-- A tentação é conceder só `select` a `authenticated`, já que toda escrita do CRM sai pelo
-- `admin()` (service-role). Seria mais restrito — e criaria DOIS MUNDOS: a instalação normal
-- com os grants amplos do Supabase, e a "recuperada" com os nossos, mais estreitos. Qualquer
-- caminho que dependesse de um privilégio a mais passaria a quebrar só em metade das
-- instalações, e essa é a classe de bug mais cara de achar.
--
-- 🔴 E O GRANT NUNCA FOI O QUE PROTEGE ESTE PRODUTO. Quem isola inquilino aqui é a RLS (leitura)
-- mais o `.eq('workspace_id', …)` do servidor (escrita) — ver a `0021`. `authenticated` já tem
-- `insert/update/delete` em toda instalação existente, pelo default do Supabase, e o que impede
-- a escrita pelo navegador é a AUSÊNCIA de policy, não a ausência de grant. Reproduzir o default
-- aqui não afrouxa nada: deixa as duas instalações idênticas, que é a propriedade que se quer.
--
-- ═══ IDEMPOTENTE E ADITIVA ════════════════════════════════════════════════════════════════
--
-- Em quem já roda, isto é no-op: concede o que já está concedido. Não há `revoke` em lugar
-- nenhum — retirar privilégio quebraria a release anterior em runtime, que é a armadilha
-- documentada na `0060`.

-- 1) O schema em si. Sem `usage`, o resto não importa: nem enxergar a tabela dá.
grant usage on schema public to anon, authenticated, service_role;

-- 2) As tabelas e sequências que já existem.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- 3) 🔴 O QUE VIER DEPOIS — e este é o passo que faz a correção durar. Sem ele, a próxima
--    migration que criar tabela num schema recriado nasce sem privilégio de novo, e o bug
--    volta na atualização seguinte. `alter default privileges` vale para os objetos criados
--    pelo papel que o executa, e as migrations rodam como o dono do banco.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- 4) 🔴 FUNÇÃO: SÓ PARA `service_role`, e a restrição é o ponto.
--
-- A tentação era `grant execute on all functions ... to anon, authenticated, service_role`, para
-- espelhar o default do Supabase. Isso seria um ERRO DE SEGURANÇA: as migrations `0001`, `0005`,
-- `0007` e `0013` REVOGAM execução de `anon`/`authenticated` em função sensível de propósito
-- (`set_secret`, `get_secret`, `enfileirar_evento`, `reservar_eventos`, …), e um `grant all`
-- aqui reabriria todas elas de uma vez. Reproduzir o default cegamente teria desfeito quatro
-- migrations de restrição.
--
-- ⚠️ E `anon`/`authenticated` NÃO PRECISAM. Medido no banco com o schema recriado: as únicas
-- funções que a sessão precisa chamar (`e_membro`, `e_owner`, `criar_workspace`,
-- `aceitar_convite`) já recebem `grant execute` explícito nas migrations que as criam — elas
-- funcionam mesmo sem default nenhum. O que faltava era só o outro lado.
--
-- O `service_role` precisa porque ele executa TUDO pelo servidor, inclusive funções que só
-- tinham `revoke` e contavam com o default para o resto — `enfileirar_evento` é a mais visível
-- (é ela que alimenta o webhook de saída). Medido: sem isto, ele não podia executar 5 funções.
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant execute on functions to service_role;
