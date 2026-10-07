-- 0016_previsao_fechamento.sql — data prevista de fechamento do negócio.
--
-- ADITIVA e NULLABLE, de propósito. É o único jeito de adicionar isto sem quebrar nada:
--   • `not null` exigiria um default, e qualquer default aqui seria uma DATA INVENTADA em
--     todo negócio já existente — o painel passaria a prometer fechamentos que ninguém
--     previu, e o vendedor não teria como distinguir o que ele preencheu do que o sistema
--     chutou. `null` diz a verdade: "ninguém informou".
--   • Sem `drop`/`rename`: expand-only, garantido por teste.
--
-- `date` e não `timestamptz`: previsão de fechamento é um DIA de negócio, não um instante.
-- Com timestamptz, um negócio previsto para 31/03 salvo por quem está em UTC-3 viraria
-- 01/04 em UTC, e ele sairia do relatório do trimestre por causa do fuso.
alter table public.negocios
  add column if not exists previsao_fechamento date;

-- Índice parcial: toda consulta do painel é "abertos que fecham até X". O `where` mantém
-- fora do índice os negócios sem previsão e os já fechados, que são a maioria das linhas e
-- nunca aparecem nessa pergunta.
create index if not exists negocios_previsao_idx
  on public.negocios (workspace_id, previsao_fechamento)
  where previsao_fechamento is not null and status = 'aberto';

comment on column public.negocios.previsao_fechamento is
  'Data prevista de fechamento (dia, sem hora). NULL = não informada — nunca preencher com estimativa do sistema.';
