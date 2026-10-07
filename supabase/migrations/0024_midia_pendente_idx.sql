-- 0024_midia_pendente_idx.sql — o indice da fila de midia.
--
-- ⚠️ ADITIVA: so cria indice. Nada aqui exige ownership de tabela do Supabase.
--
-- 🔴 SEM ELE O DRENO DE MIDIA VARRE `mensagens` INTEIRA A CADA ~30 SEGUNDOS. Essa e a unica
-- tabela do produto que cresce sem teto, e o predicado `midia->>'status' = 'pendente'` nao
-- e coberto por nenhum dos indices da 0022 (workspace, thread, externo_id). O sintoma nao
-- aparece em dev nem no primeiro mes: ele aparece no comprador com volume, como um tick que
-- fica lento e nunca mais volta — e o tick e quem roda o `baterLicenca()`.
--
-- PARCIAL, e o predicado e IGUAL ao da consulta. Isso e o que o mantem minusculo: so as
-- linhas que ainda estao esperando download entram, e cada uma sai do indice no momento em
-- que o dreno a carimba `ok` ou `erro`. Numa instalacao em dia ele tem poucas dezenas de
-- linhas, nao uma por mensagem ja trocada.
--
-- A coluna indexada e `criado_em` porque a consulta ordena por ela: assim o `limit` do teto
-- por tick vira leitura das primeiras entradas do indice, e nao uma ordenacao do conjunto.
create index if not exists mensagens_midia_pendente_idx
  on public.mensagens (criado_em)
  where midia->>'status' = 'pendente';
