-- 0054_horario_de_atendimento.sql — a empresa passa a poder dizer QUANDO ela atende.
--
-- 🔴 O NUMERO E 0054, E ELE FOI MEDIDO, NAO ESCOLHIDO. Esta branch usa 0021..0053; a `main`
-- usa as mesmas MAIS a 0060_escritas_de_authenticated.sql. A faixa 0054..0059 esta livre nas
-- duas, e a faixa 9000+ e reservada ao comprador (o `planMigrations` a recusa em migration
-- oficial, com `oficial_na_faixa_custom`).
--
-- O que foi rodado contra o `planMigrations` REAL do `migrate.mjs`, e o que ele respondeu:
--   · 0054 pendente com TUDO o mais aplicado, inclusive a 0060 da main (o cenario do merge):
--     `error=null`, `apply=[0054]`, `outOfOrder=[0054]` — ou seja, ela APLICA. O
--     `outOfOrder` e so um `console.warn` do `main()`; ele nao recusa e nao pula. Nem
--     recusar nem pular em silencio e o que decide o numero: pular em silencio e o modo de
--     falha que este repositorio ja pagou, e ele nao acontece aqui.
--   · escolher 0060 (o numero que a main JA usa) devolve `duplicate_version` e o
--     `migrate.mjs` sai com 1 — container que NAO SOBE, em TODA instalacao, no dia do merge.
--     E o modo alto, e e por isso que 0060 esta fora de questao.
--
-- 🔴 ADITIVA / EXPAND-ONLY, e conferido linha a linha: uma tabela nova, duas policies novas
-- sobre ela, nada de `drop`, nada de `alter` em objeto que ja existe, nada de `revoke`. O
-- Desfazer da atualizacao em 1 clique volta o CODIGO e nao o BANCO — uma migration que
-- RETIRA privilegio quebra a release anterior de quem desfizer, e o efeito de um `drop
-- policy` e mudo (o `update` casa zero linhas com HTTP 200). Aqui nao ha o que retirar: a
-- versao anterior nao conhece esta tabela, entao desfazer so a deixa parada.
--
-- 🔴 E O PADRAO PRESERVA EXATAMENTE O COMPORTAMENTO DE HOJE. A tabela nasce VAZIA: nenhum
-- espaco de trabalho tem linha, e nao ha backfill de proposito. Ausencia de linha significa
-- "sem horario configurado", que o modulo puro traduz em `sem_horario` — e `sem_horario` nao
-- acrescenta uma palavra ao texto do modelo. Mesmo idioma da 0041: ausencia de configuracao
-- significa o comportamento antigo.
--
-- ⚠️ E a leitura simetrica esta escrita no modulo puro: `faixas` em `[]` — que e o default da
-- coluna — tambem e "sem horario", e NUNCA "fechado o tempo todo". A leitura oposta faria toda
-- instalacao que apenas recebeu esta migration comecar a avisar o cliente que esta fora do
-- horario, em toda conversa, sem ninguem ter pedido nada.
--
-- 🔴 FORA DO HORARIO O ASSISTENTE CONTINUA RESPONDENDO. Esta tabela nao desliga nada e nao
-- entra em decisao de fila nenhuma: o que ela muda e a COPY, que passa a dizer a partir de
-- quando alguem do time responde. Calar fora do horario seria pior — o cliente escreve a noite
-- e nao recebe nada.

create table if not exists public.horario_atendimento (
  -- 🔴 O ESPACO DE TRABALHO E A CHAVE PRIMARIA, e nao uma coluna a mais com indice: o horario
  -- e UM por inquilino. Uma tabela com `id` proprio aceitaria duas linhas para o mesmo espaco,
  -- e a leitura do turno teria de escolher uma — a empresa atenderia num horario hoje e noutro
  -- amanha, sem erro em lugar nenhum. E a mesma decisao do indice parcial de `assistentes`
  -- (no maximo um padrao), tomada pela chave em vez de por indice porque aqui e um-para-um.
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  -- O fuso de IANA da empresa. O produto NAO tinha fuso em lugar nenhum ate aqui: o servidor
  -- roda no fuso do conteiner (UTC) e toda conversao de hoje e do NAVEGADOR. Este turno roda
  -- no tick, sem navegador nenhum, entao o fuso precisa estar escrito.
  --
  -- O `check` de comprimento e a mesma doutrina dos tres tetos de `assistentes`: a validacao da
  -- tela devolve uma frase em portugues, o `check` e a barreira de quem escreve por fora dela.
  -- Qual nome e VALIDO e lista fechada no codigo (16 fusos brasileiros) — de proposito nao
  -- aqui: um `check` com dezesseis literais viraria a segunda copia da lista, e duas copias
  -- divergem. Nome que o codigo nao reconhece cai em `sem_horario`, que e o chao seguro.
  fuso text not null default 'America/Sao_Paulo' check (length(fuso) between 1 and 64),
  -- As janelas, como `[{"dia":1,"inicio":"09:00","fim":"18:00"}, ...]`; `dia` 0 = domingo.
  -- `[]` e o default e significa SEM HORARIO CONFIGURADO — ver o cabecalho.
  faixas jsonb not null default '[]'::jsonb check (jsonb_typeof(faixas) = 'array'),
  -- Excecoes pontuais, como `["2026-12-25"]`, no fuso acima. O dia inteiro fecha.
  feriados jsonb not null default '[]'::jsonb check (jsonb_typeof(feriados) = 'array'),
  atualizado_em timestamptz not null default now()
);

alter table public.horario_atendimento enable row level security;

-- GUARDADA pelo `pg_policies`, como a 0028 e a 0039: o Postgres nao tem
-- `create policy if not exists`, e este arquivo abre com `create table if not exists`.
-- Tolerancia declarada em cima e DDL nu embaixo e meia-idempotencia — a reexecucao passa pela
-- tabela e morre aqui, com `42710`, e migration que falha e container que NAO SOBE.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'horario_atendimento'
       and policyname = 'horario_atendimento_service'
  ) then
    create policy horario_atendimento_service on public.horario_atendimento
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- 🔴 `for select`, e NAO `for all`. Desde a caixa de entrada existe cliente do banco rodando no
-- NAVEGADOR, e do lado do servidor de dados nao existe como distinguir "o servidor agindo em
-- nome do usuario" de "o navegador agindo como o usuario" — e o mesmo token. Uma policy de
-- escrita para `authenticated` autorizaria a mesma escrita disparada do console, pulando a
-- tela, a validacao das faixas e o gate de licenca. A escrita sai toda pelo cliente de servico,
-- com o filtro de espaco de trabalho explicito no codigo.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'horario_atendimento'
       and policyname = 'horario_atendimento_membro'
  ) then
    create policy horario_atendimento_membro on public.horario_atendimento
      for select to authenticated using (public.e_membro(workspace_id));
  end if;
end $$;

comment on table public.horario_atendimento is
  'Quando a empresa atende. Linha ausente ou faixas vazias = sem horario configurado, que e o comportamento anterior a esta migration. Fora do horario o assistente CONTINUA respondendo: o que muda e a copy.';
