-- 0004_multi_tenancy.sql — schema de multi-tenancy: workspaces + membros + convites, e
-- workspace_id nas 6 tabelas do 0002. Expand-only sobre 0002/0003.
-- PRE-FLIGHT: exige tabelas de negocio VAZIAS. `add column NOT NULL` sem default so passa
-- com 0 linhas, e o drop do seed global do 0003 assume que nada o referencia.

-- == tenants ================================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dono_id uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now()
);

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('owner','membro')),
  criado_em timestamptz not null default now(),
  unique (workspace_id, user_id),
  unique (workspace_id, id)   -- alvo da FK composta de negocios.responsavel_id
);
create index membros_user_idx on public.membros (user_id);

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token text not null unique,
  papel text not null check (papel in ('owner','membro')),
  email text,
  criado_por uuid references auth.users(id) on delete set null,
  expira_em timestamptz not null,
  aceito_em timestamptz,
  aceito_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index convites_workspace_idx on public.convites (workspace_id);

-- == drop do seed global do 0003 (banco vazio -> seguro; funil vira por-workspace) ==
delete from public.etapas where pipeline_id in (select id from public.pipelines where is_padrao);
delete from public.pipelines where is_padrao;

-- == workspace_id nas 6 tabelas (empty -> add not null sem default OK) ======
alter table public.empresas   add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
alter table public.contatos   add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
alter table public.pipelines  add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
alter table public.etapas     add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
alter table public.negocios   add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
alter table public.atividades add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
create index empresas_ws_idx   on public.empresas   (workspace_id);
create index contatos_ws_idx   on public.contatos   (workspace_id);
create index pipelines_ws_idx  on public.pipelines  (workspace_id);
create index etapas_ws_idx     on public.etapas     (workspace_id);
create index negocios_ws_idx   on public.negocios   (workspace_id);
create index atividades_ws_idx on public.atividades (workspace_id);

-- == unicidade agora POR workspace =========================================
drop index contatos_chave_externa_key;
drop index negocios_chave_externa_key;
drop index atividades_chave_externa_key;
create unique index contatos_chave_externa_key   on public.contatos   (workspace_id, chave_externa) where chave_externa is not null;
create unique index negocios_chave_externa_key   on public.negocios   (workspace_id, chave_externa) where chave_externa is not null;
create unique index atividades_chave_externa_key on public.atividades (workspace_id, chave_externa) where chave_externa is not null;

drop index pipelines_um_padrao;                 -- era global (0002:38)
create unique index pipelines_um_padrao on public.pipelines (workspace_id) where is_padrao;  -- 1 padrao POR workspace

-- == responsavel_id: FK COMPOSTA (responsavel = membro do MESMO workspace) ==
-- SET NULL so na coluna responsavel_id (PG15+); workspace_id e NOT NULL e nao pode
-- ir a null. MATCH SIMPLE: responsavel_id null -> FK nao checada (responsavel opcional).
alter table public.negocios
  add constraint negocios_responsavel_fk
  foreign key (workspace_id, responsavel_id)
  references public.membros (workspace_id, id) on delete set null (responsavel_id);

-- == gate de signup (settings ja existe no 0001) ===========================
insert into public.settings (key, value) values
  ('bootstrap_feito', 'false'),
  ('signup_aberto', 'false')
on conflict (key) do nothing;

-- == RLS baseline nas tabelas novas (policies por-usuario no 0005) ==========
alter table public.workspaces enable row level security;
alter table public.membros    enable row level security;
alter table public.convites   enable row level security;
create policy workspaces_service_role on public.workspaces for all to service_role using (true) with check (true);
create policy membros_service_role    on public.membros    for all to service_role using (true) with check (true);
create policy convites_service_role   on public.convites   for all to service_role using (true) with check (true);
