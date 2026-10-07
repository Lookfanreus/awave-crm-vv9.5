-- 0012_sla_historico.sql — prazo por etapa + historico de movimentacao do negocio.
-- Aditivo/expand-only. O relogio e mantido por TRIGGER: existem 5 caminhos que trocam
-- etapa_id (mudarEtapa, moverNegocio, mudarFunil, API mover-etapa e o UPDATE EM MASSA de
-- excluirEtapa, crm/funis.ts:205) — confiar em todos lembrarem e como o dado apodrece.

-- == prazo e probabilidade por etapa =======================================
alter table public.etapas
  add column sla_dias int check (sla_dias is null or sla_dias > 0),
  add column probabilidade int check (probabilidade is null or probabilidade between 0 and 100);

-- == quando o negocio entrou na etapa atual ================================
-- DEFAULT now() -> seguro em tabela COM linhas; o backfill logo abaixo corrige o passado.
alter table public.negocios add column etapa_desde timestamptz not null default now();
update public.negocios set etapa_desde = criado_em;

-- == historico de passagens ================================================
create table public.historico_etapas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  negocio_id uuid not null,
  etapa_id uuid not null,
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz,
  constraint historico_negocio_fk foreign key (workspace_id, negocio_id)
    references public.negocios (workspace_id, id) on delete cascade,
  constraint historico_etapa_fk foreign key (workspace_id, etapa_id)
    references public.etapas (workspace_id, id) on delete cascade
);
create index historico_etapas_neg_idx on public.historico_etapas (negocio_id, entrou_em);
-- Indice parcial da linha ABERTA: e a que toda trigger procura.
create index historico_etapas_aberto_idx on public.historico_etapas (negocio_id) where saiu_em is null;

-- Backfill: uma linha aberta por negocio, a partir da criacao. A UI rotula esses numeros
-- como "desde a criacao" ate haver movimento real (spec CA-6.6).
insert into public.historico_etapas (workspace_id, negocio_id, etapa_id, entrou_em)
select workspace_id, id, etapa_id, criado_em from public.negocios;

-- == trigger 1: troca de etapa =============================================
-- BEFORE UPDATE ... FOR EACH ROW: cobre os 5 caminhos, inclusive o UPDATE em massa do
-- excluirEtapa (dispara uma vez POR LINHA, nao uma vez pelo comando).
create or replace function public.trg_negocio_etapa_desde()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.etapa_desde := now();
  update public.historico_etapas set saiu_em = now()
    where negocio_id = new.id and saiu_em is null;
  insert into public.historico_etapas (workspace_id, negocio_id, etapa_id)
    values (new.workspace_id, new.id, new.etapa_id);
  return new;
end $$;
create trigger negocios_etapa_desde before update of etapa_id on public.negocios
  for each row when (old.etapa_id is distinct from new.etapa_id)
  execute function public.trg_negocio_etapa_desde();

-- == trigger 2: negocio FECHA sem trocar de etapa ==========================
-- Sem isto o CA-6.7 nao acontece: ganhar/perder nao mexe em etapa_id, entao a trigger
-- acima nao dispara e a linha aberta contaria pra sempre. Espelha o gatilho de status do
-- 0007:98-100. Reabrir (ganho -> aberto) NAO reabre a linha: abre uma nova.
create or replace function public.trg_negocio_fecha_historico()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.historico_etapas set saiu_em = coalesce(new.fechado_em, now())
    where negocio_id = new.id and saiu_em is null;
  return null;
end $$;
create trigger negocios_fecha_historico after update of status on public.negocios
  for each row when (old.status = 'aberto' and new.status in ('ganho','perdido'))
  execute function public.trg_negocio_fecha_historico();

-- == trigger 3: negocio NOVO abre a 1a linha ===============================
create or replace function public.trg_negocio_abre_historico()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.historico_etapas (workspace_id, negocio_id, etapa_id)
    values (new.workspace_id, new.id, new.etapa_id);
  return null;
end $$;
create trigger negocios_abre_historico after insert on public.negocios
  for each row execute function public.trg_negocio_abre_historico();

-- == grants ================================================================
-- As 3 funcoes sao SECURITY DEFINER. No Supabase, ALTER DEFAULT PRIVILEGES concede EXECUTE
-- a `authenticated` na CRIACAO — revogar so de `public, anon` NAO tira esse grant. Funcao de
-- TRIGGER nao e chamavel por RPC, mas revogamos dos tres assim mesmo: e o padrao do repo
-- (0001, 0008), e uma excecao aqui so criaria uma segunda regra pra lembrar.
revoke all on function public.trg_negocio_etapa_desde()     from public, anon, authenticated;
revoke all on function public.trg_negocio_fecha_historico() from public, anon, authenticated;
revoke all on function public.trg_negocio_abre_historico()  from public, anon, authenticated;

-- == RLS par (service_role + membro), padrao 0006/0009/0011 ================
alter table public.historico_etapas enable row level security;
create policy historico_etapas_service_role on public.historico_etapas
  for all to service_role using (true) with check (true);
-- Membro so LE: o historico e escrito por trigger, nunca pela UI.
create policy historico_etapas_membro on public.historico_etapas
  for select to authenticated using (public.e_membro(workspace_id));
