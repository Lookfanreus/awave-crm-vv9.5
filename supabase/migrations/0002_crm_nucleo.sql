-- Nucleo de dados do CRM: empresas, contatos, pipelines, etapas, negocios e atividades.
-- Aditivo sobre o 0001 (Vault). Toda tabela: RLS on + policy service_role (a camada roda server-side).
-- DDL: sem grant a anon; SECURITY DEFINER (o trigger) com search_path fixo, como o 0001.

create or replace function public.set_atualizado_em()
returns trigger language plpgsql security definer set search_path = '' as $$
begin new.atualizado_em = now(); return new; end; $$;  -- search_path='' como o 0001; now() e pg_catalog (sempre visivel), o corpo nao referencia objeto nao-qualificado

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null, site text, telefone text, notas text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger empresas_set_atualizado before update on public.empresas
  for each row execute function public.set_atualizado_em();

create table public.contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null, email text, telefone text,
  chave_externa text, origem text, notas text,
  empresa_id uuid references public.empresas(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index contatos_chave_externa_key on public.contatos (chave_externa) where chave_externa is not null;
create index contatos_empresa_idx on public.contatos (empresa_id);
create index contatos_email_idx on public.contatos (email) where email is not null;
create trigger contatos_set_atualizado before update on public.contatos
  for each row execute function public.set_atualizado_em();

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  nome text not null, ordem int not null default 0,
  is_padrao boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index pipelines_um_padrao on public.pipelines (is_padrao) where is_padrao;

create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  nome text not null, ordem int not null, cor text,
  criado_em timestamptz not null default now(),
  unique (pipeline_id, id)   -- alvo da FK composta de negocios
);
create index etapas_pipeline_idx on public.etapas (pipeline_id, ordem);

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  valor numeric(14,2),
  moeda text not null default 'BRL',
  status text not null default 'aberto' check (status in ('aberto','ganho','perdido')),
  motivo_perda text,
  ordem int not null default 0,
  responsavel_id uuid,          -- FK p/ usuarios entra na 1b (bare uuid por ora)
  chave_externa text,
  contato_id uuid references public.contatos(id) on delete set null,
  empresa_id uuid references public.empresas(id) on delete set null,
  pipeline_id uuid not null references public.pipelines(id) on delete restrict,
  etapa_id uuid not null,       -- integridade via FK COMPOSTA abaixo (nao FK simples — evita redundancia)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  fechado_em timestamptz,
  foreign key (pipeline_id, etapa_id) references public.etapas (pipeline_id, id)
);
create index negocios_etapa_ordem_idx on public.negocios (etapa_id, ordem);
create index negocios_pipeline_idx on public.negocios (pipeline_id);
create index negocios_contato_idx on public.negocios (contato_id);
create unique index negocios_chave_externa_key on public.negocios (chave_externa) where chave_externa is not null;
create trigger negocios_set_atualizado before update on public.negocios
  for each row execute function public.set_atualizado_em();

create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('nota','ligacao','email','evento','resumo_ia','etapa_mudou')),
  conteudo text,
  autor text not null default 'staff' check (autor in ('staff','ia')),
  chave_externa text,
  contato_id uuid references public.contatos(id) on delete cascade,
  negocio_id uuid references public.negocios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint atividades_alvo_present check (contato_id is not null or negocio_id is not null)
);
create index atividades_contato_idx on public.atividades (contato_id, criado_em desc);
create index atividades_negocio_idx on public.atividades (negocio_id, criado_em desc);
create unique index atividades_chave_externa_key on public.atividades (chave_externa) where chave_externa is not null;

-- RLS: service_role em todas. As policies de sessao (authenticated) chegam na 0005.
alter table public.empresas   enable row level security;
alter table public.contatos   enable row level security;
alter table public.pipelines  enable row level security;
alter table public.etapas     enable row level security;
alter table public.negocios   enable row level security;
alter table public.atividades enable row level security;
create policy empresas_service_role   on public.empresas   for all to service_role using (true) with check (true);
create policy contatos_service_role   on public.contatos   for all to service_role using (true) with check (true);
create policy pipelines_service_role  on public.pipelines  for all to service_role using (true) with check (true);
create policy etapas_service_role     on public.etapas     for all to service_role using (true) with check (true);
create policy negocios_service_role   on public.negocios   for all to service_role using (true) with check (true);
create policy atividades_service_role on public.atividades for all to service_role using (true) with check (true);
