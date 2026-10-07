-- Seed: 1 pipeline padrao ("Funil de vendas") com 5 etapas ordenadas.
-- Idempotente: so semeia se ainda nao ha pipeline padrao (re-run seguro).
insert into public.pipelines (nome, ordem, is_padrao)
select 'Funil de vendas', 0, true
where not exists (select 1 from public.pipelines where is_padrao);

with p as (select id from public.pipelines where is_padrao)
insert into public.etapas (pipeline_id, nome, ordem, cor)
select p.id, e.nome, e.ordem, e.cor
from p, (values
  ('Novo lead', 0, '#94a3b8'),
  ('Contato feito', 1, '#60a5fa'),
  ('Proposta', 2, '#a78bfa'),
  ('Negociacao', 3, '#fbbf24'),
  ('Fechamento', 4, '#34d399')
) as e(nome, ordem, cor)
where not exists (select 1 from public.etapas et join p on et.pipeline_id = p.id);
