-- 0007_webhook_egress.sql — webhook de saida: o CRM avisa a integracao (event egress).
-- Aditivo/expand-only. Outbox + config por-ws + triggers de captura + RPCs.
-- Padrão: RLS par (service_role + membro) como 0006; SECURITY DEFINER set search_path=''
-- e objetos SEMPRE qualificados (public.*), como set_atualizado_em (0002).

-- == outbox ================================================================
create table public.eventos_webhook (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tipo text not null,
  payload jsonb not null,
  criado_em timestamptz not null default now(),
  entregue_em timestamptz,
  tentativas int not null default 0,
  proxima_tentativa timestamptz not null default now(),
  ultimo_erro text,
  desistido_em timestamptz
);
create index eventos_webhook_pendentes_idx on public.eventos_webhook (proxima_tentativa)
  where entregue_em is null and desistido_em is null;
alter table public.eventos_webhook enable row level security;
create policy eventos_webhook_service_role on public.eventos_webhook
  for all to service_role using (true) with check (true);
-- SEM policy membro: ninguém no painel lê o outbox nesta fatia (viewer = depois).

-- == config por-workspace ==================================================
create table public.webhook_config (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  endpoint_url text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger webhook_config_set_atualizado before update on public.webhook_config
  for each row execute function public.set_atualizado_em();
alter table public.webhook_config enable row level security;
create policy webhook_config_service_role on public.webhook_config
  for all to service_role using (true) with check (true);
create policy webhook_config_membro on public.webhook_config
  for all to authenticated
  using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));

-- == enfileirar_evento (chamada pelas triggers) ============================
create or replace function public.enfileirar_evento(p_tipo text, p_ws uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.eventos_webhook (workspace_id, tipo, payload) values (p_ws, p_tipo, p_payload);
end $$;
revoke all on function public.enfileirar_evento(text, uuid, jsonb) from public, anon;

-- == triggers de captura ===================================================
create or replace function public.trg_contato_lead_novo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enfileirar_evento('lead_novo', new.workspace_id, jsonb_build_object(
    'contato', jsonb_build_object('id', new.id, 'nome', new.nome, 'email', new.email,
      'telefone', new.telefone, 'origem', new.origem, 'empresa_id', new.empresa_id,
      'chave_externa', new.chave_externa)));
  return null;
end $$;
create trigger contatos_lead_novo after insert on public.contatos
  for each row execute function public.trg_contato_lead_novo();

create or replace function public.trg_negocio_novo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enfileirar_evento('deal_novo', new.workspace_id, jsonb_build_object(
    'negocio', jsonb_build_object('id', new.id, 'titulo', new.titulo, 'valor', new.valor,
      'status', new.status, 'etapa_id', new.etapa_id, 'pipeline_id', new.pipeline_id,
      'contato_id', new.contato_id, 'empresa_id', new.empresa_id, 'chave_externa', new.chave_externa)));
  return null;
end $$;
create trigger negocios_novo after insert on public.negocios
  for each row execute function public.trg_negocio_novo();

create or replace function public.trg_negocio_etapa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enfileirar_evento('etapa_mudou', new.workspace_id, jsonb_build_object(
    'negocio', jsonb_build_object('id', new.id, 'titulo', new.titulo, 'pipeline_id', new.pipeline_id),
    'de_etapa_id', old.etapa_id, 'para_etapa_id', new.etapa_id));
  return null;
end $$;
create trigger negocios_etapa after update of etapa_id on public.negocios
  for each row when (old.etapa_id is distinct from new.etapa_id)
  execute function public.trg_negocio_etapa();

create or replace function public.trg_negocio_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tipo text;
begin
  v_tipo := case new.status when 'ganho' then 'deal_ganho' when 'perdido' then 'deal_perdido' end;
  perform public.enfileirar_evento(v_tipo, new.workspace_id, jsonb_build_object(
    'negocio', jsonb_build_object('id', new.id, 'titulo', new.titulo, 'valor', new.valor,
      'status', new.status, 'motivo_perda', new.motivo_perda)));
  return null;
end $$;
create trigger negocios_status after update of status on public.negocios
  for each row when (old.status = 'aberto' and new.status in ('ganho','perdido'))
  execute function public.trg_negocio_status();

-- == reservar_eventos: claim atômico (FOR UPDATE SKIP LOCKED) ==============
-- PostgREST não faz row-locking → RPC. Reserva bumpando proxima_tentativa (outro tick pula);
-- na falha, entregarPendentes reescreve com o backoff real.
create or replace function public.reservar_eventos(p_limite int, p_reserva interval default interval '2 minutes')
returns setof public.eventos_webhook language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.eventos_webhook e
    set proxima_tentativa = now() + p_reserva
  where e.id in (
    select id from public.eventos_webhook
    where entregue_em is null and desistido_em is null and proxima_tentativa <= now()
    order by criado_em
    limit p_limite
    for update skip locked
  )
  returning e.*;
end $$;
revoke all on function public.reservar_eventos(int, interval) from public, anon;
grant execute on function public.reservar_eventos(int, interval) to service_role;
