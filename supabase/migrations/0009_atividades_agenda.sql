-- 0009_atividades_agenda.sql — Atividades·A: tipos customizáveis + agenda.
-- Aditivo/expand-only. Substitui atividades.tipo(text) por tipo_id(FK) c/ backfill; estende
-- atividades p/ agenda (vencimento/concluida_em/responsavel_id). RLS par (0006). FK compostas (0004).

-- == tipos_atividade (por workspace) =======================================
create table public.tipos_atividade (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null,
  nome text not null,
  icone text not null default 'Circle',
  natureza text not null check (natureza in ('atividade','nota','sistema')),
  ordem int not null default 0,
  bloqueado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (workspace_id, slug),
  unique (workspace_id, id)   -- alvo da FK composta de atividades.tipo_id
);
create index tipos_atividade_ws_idx on public.tipos_atividade (workspace_id, ordem);
alter table public.tipos_atividade enable row level security;
create policy tipos_atividade_service_role on public.tipos_atividade
  for all to service_role using (true) with check (true);
create policy tipos_atividade_membro on public.tipos_atividade
  for all to authenticated
  using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));

-- == seed dos workspaces EXISTENTES ========================================
insert into public.tipos_atividade (workspace_id, slug, nome, icone, natureza, ordem, bloqueado)
select w.id, d.slug, d.nome, d.icone, d.natureza, d.ordem, d.bloqueado
from public.workspaces w
cross join (values
  ('ligacao','Ligação','Phone','atividade',0,false),
  ('reuniao','Reunião','Users','atividade',1,false),
  ('tarefa','Tarefa','CircleCheck','atividade',2,false),
  ('email','E-mail','Mail','atividade',3,false),
  ('prazo','Prazo','Flag','atividade',4,false),
  ('nota','Nota','StickyNote','nota',5,true),
  ('etapa_mudou','Etapa mudou','ArrowRight','sistema',6,true),
  ('resumo_ia','Resumo IA','Sparkles','sistema',7,true)
) as d(slug,nome,icone,natureza,ordem,bloqueado);

-- == estende atividades ====================================================
alter table public.atividades
  add column tipo_id uuid,
  add column vencimento timestamptz,
  add column concluida_em timestamptz,
  add column responsavel_id uuid;

-- backfill: mapeia o texto antigo -> tipo semeado (evento -> reuniao)
update public.atividades a
set tipo_id = t.id
from public.tipos_atividade t
where t.workspace_id = a.workspace_id
  and t.slug = case a.tipo when 'evento' then 'reuniao' else a.tipo end;

alter table public.atividades alter column tipo_id set not null;

-- FK composta do tipo (garante tipo do MESMO ws); restrict = não dropa tipo em uso
alter table public.atividades
  add constraint atividades_tipo_fk
  foreign key (workspace_id, tipo_id)
  references public.tipos_atividade (workspace_id, id) on delete restrict;

-- FK composta do responsável (membro do MESMO ws; SET NULL só na coluna, PG15) — como negocios (0004:71-74)
alter table public.atividades
  add constraint atividades_responsavel_fk
  foreign key (workspace_id, responsavel_id)
  references public.membros (workspace_id, id) on delete set null (responsavel_id);

create index atividades_agenda_idx on public.atividades (workspace_id, vencimento)
  where vencimento is not null and concluida_em is null;
create index atividades_responsavel_idx on public.atividades (workspace_id, responsavel_id);

-- aposenta o tipo texto (leva o CHECK junto)
alter table public.atividades drop column tipo;

-- == criar_workspace: semear tipos p/ workspace NOVO =======================
-- (create or replace do 0005:41-59 + o insert dos 8 tipos antes do return)
create or replace function public.criar_workspace(nome text, p_dono uuid default auth.uid())
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ws uuid; v_pipe uuid;
begin
  if p_dono is null then raise exception 'dono ausente'; end if;
  insert into public.workspaces (nome, dono_id) values (nome, p_dono) returning id into v_ws;
  insert into public.membros (workspace_id, user_id, papel) values (v_ws, p_dono, 'owner');
  insert into public.pipelines (workspace_id, nome, ordem, is_padrao)
    values (v_ws, 'Funil de vendas', 0, true) returning id into v_pipe;
  insert into public.etapas (workspace_id, pipeline_id, nome, ordem, cor)
  select v_ws, v_pipe, e.nome, e.ordem, e.cor from (values
    ('Novo lead', 0, '#94a3b8'), ('Contato feito', 1, '#60a5fa'),
    ('Proposta', 2, '#a78bfa'), ('Negociacao', 3, '#fbbf24'),
    ('Fechamento', 4, '#34d399')
  ) as e(nome, ordem, cor);
  insert into public.tipos_atividade (workspace_id, slug, nome, icone, natureza, ordem, bloqueado)
  select v_ws, d.slug, d.nome, d.icone, d.natureza, d.ordem, d.bloqueado from (values
    ('ligacao','Ligação','Phone','atividade',0,false),
    ('reuniao','Reunião','Users','atividade',1,false),
    ('tarefa','Tarefa','CircleCheck','atividade',2,false),
    ('email','E-mail','Mail','atividade',3,false),
    ('prazo','Prazo','Flag','atividade',4,false),
    ('nota','Nota','StickyNote','nota',5,true),
    ('etapa_mudou','Etapa mudou','ArrowRight','sistema',6,true),
    ('resumo_ia','Resumo IA','Sparkles','sistema',7,true)
  ) as d(slug,nome,icone,natureza,ordem,bloqueado);
  return v_ws;
end $$;
