-- 0006_credenciais_api.sql — credenciais de API por-workspace (a integracao chamando o CRM).
-- Aditivo/expand-only. Só METADADOS aqui; o segredo HMAC vive no Vault (nome api_key:<key_id>).
-- RLS = par service_role (gate/admin) + membro (sessão), como as tabelas do 0002/0004.

create table public.credenciais_api (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key_id text not null unique,       -- público; o gate busca por ele (unique já indexa)
  rotulo text not null,              -- rótulo humano ("Motor", "IA produção")
  criado_em timestamptz not null default now(),
  revogado_em timestamptz            -- null = ativa; o gate rejeita se preenchida
);
create index credenciais_api_ws_idx on public.credenciais_api (workspace_id);

alter table public.credenciais_api enable row level security;
create policy credenciais_api_service_role on public.credenciais_api
  for all to service_role using (true) with check (true);
create policy credenciais_api_membro on public.credenciais_api
  for all to authenticated
  using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
