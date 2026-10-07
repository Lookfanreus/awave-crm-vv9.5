-- 0013_automacoes.sql — motor de regras gatilho→condicao→acao.
-- Aditiva: 4 tabelas novas, 1 RPC, 2 triggers NOVAS em negocios. Nada existente muda.
-- As triggers do 0007 (webhook de saida) ficam intactas de proposito.

create table public.automacoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pipeline_id uuid,
  nome text not null,
  ativo boolean not null default false,          -- nasce DESLIGADA (revisao consciente)
  gatilho text not null,
  gatilho_config jsonb not null default '{}',
  condicoes jsonb,                                -- null = sem condicao
  acoes jsonb not null,                           -- [{tipo, ...}]
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (workspace_id, id),
  constraint automacoes_pipeline_fk foreign key (workspace_id, pipeline_id)
    references public.pipelines (workspace_id, id) on delete cascade
);
create trigger automacoes_set_atualizado before update on public.automacoes
  for each row execute function public.set_atualizado_em();

create table public.fatos_automacao (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tipo text not null,
  negocio_id uuid,                 -- MATCH SIMPLE: null -> FK nao checada (fato sem negocio)
  dados jsonb not null default '{}',
  origem_automacao_id uuid,        -- anti-loop camada 1 (GUC awave.automacao_id)
  processado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint fatos_negocio_fk foreign key (workspace_id, negocio_id)
    references public.negocios (workspace_id, id) on delete cascade
);
create index fatos_pendentes_idx on public.fatos_automacao (criado_em) where processado_em is null;

create table public.execucoes_automacao (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  automacao_id uuid not null,
  negocio_id uuid,                 -- MATCH SIMPLE: null -> FK nao checada
  fato_id uuid references public.fatos_automacao(id) on delete set null,
  estado text not null default 'pendente'
    check (estado in ('pendente','ok','erro','desistido','cancelado')),
  tentativas int not null default 0,
  proxima_tentativa timestamptz not null default now(),
  ultimo_erro text,
  resultado jsonb,
  criado_em timestamptz not null default now(),
  executado_em timestamptz,
  constraint execucoes_automacao_fk foreign key (workspace_id, automacao_id)
    references public.automacoes (workspace_id, id) on delete cascade,
  constraint execucoes_negocio_fk   foreign key (workspace_id, negocio_id)
    references public.negocios   (workspace_id, id) on delete cascade
);
create index execucoes_pendentes_idx on public.execucoes_automacao (proxima_tentativa)
  where estado = 'pendente';
create index execucoes_disjuntor_idx on public.execucoes_automacao (negocio_id, criado_em);

create table public.automacao_marcas (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  automacao_id uuid not null,
  negocio_id uuid not null,
  marca text not null,
  criado_em timestamptz not null default now(),
  primary key (automacao_id, negocio_id, marca),
  constraint marcas_automacao_fk foreign key (workspace_id, automacao_id)
    references public.automacoes (workspace_id, id) on delete cascade,
  constraint marcas_negocio_fk   foreign key (workspace_id, negocio_id)
    references public.negocios   (workspace_id, id) on delete cascade
);

-- Claim atomico: gemeo de reservar_eventos (0007:105).
create or replace function public.reservar_execucoes(p_limite int, p_reserva interval default interval '2 minutes')
returns setof public.execucoes_automacao language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.execucoes_automacao e set proxima_tentativa = now() + p_reserva
  where e.id in (
    select id from public.execucoes_automacao
    where estado = 'pendente' and proxima_tentativa <= now()
    order by criado_em limit p_limite for update skip locked)
  returning e.*;
end $$;
-- Revoga EXECUTE de public, anon E `authenticated`: esta funcao e SECURITY DEFINER e so deve
-- ser chamada pelo processo interno (service_role, no grant logo abaixo). O `authenticated` e
-- obrigatorio na lista — no Supabase, ALTER DEFAULT PRIVILEGES ja concedeu EXECUTE a ele na
-- CRIACAO da funcao, entao revogar so de `public, anon` nao tira esse grant.
revoke all on function public.reservar_execucoes(int, interval) from public, anon, authenticated;
grant execute on function public.reservar_execucoes(int, interval) to service_role;

-- Triggers de fato: NOVAS e SEPARADAS. As de 0007 (egress p/ o Motor) ficam intactas.
create or replace function public.trg_fato_negocio()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tipo text; v_origem uuid;
begin
  v_origem := nullif(current_setting('awave.automacao_id', true), '')::uuid;
  v_tipo := case
    when tg_op = 'INSERT' then 'negocio_criado'
    when old.status = 'aberto' and new.status = 'ganho' then 'negocio_ganho'
    when old.status = 'aberto' and new.status = 'perdido' then 'negocio_perdido'
    when old.etapa_id is distinct from new.etapa_id then 'negocio_movido'
    when old.campos is distinct from new.campos then 'campo_alterado'
  end;
  if v_tipo is null then return null; end if;
  insert into public.fatos_automacao (workspace_id, tipo, negocio_id, origem_automacao_id, dados)
  values (new.workspace_id, v_tipo, new.id, v_origem, jsonb_build_object(
    'de_etapa_id', case when tg_op = 'UPDATE' then old.etapa_id end,
    'para_etapa_id', new.etapa_id,
    'campos_antes', case when tg_op = 'UPDATE' then old.campos end,
    'campos_depois', new.campos));
  return null;
end $$;
create trigger negocios_fato_ins after insert on public.negocios
  for each row execute function public.trg_fato_negocio();
create trigger negocios_fato_upd after update on public.negocios
  for each row execute function public.trg_fato_negocio();

alter table public.automacoes          enable row level security;
alter table public.fatos_automacao     enable row level security;
alter table public.execucoes_automacao enable row level security;
alter table public.automacao_marcas    enable row level security;
create policy automacoes_service_role on public.automacoes for all to service_role using (true) with check (true);
create policy automacoes_membro on public.automacoes for all to authenticated
  using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
create policy execucoes_service_role on public.execucoes_automacao for all to service_role using (true) with check (true);
create policy execucoes_membro on public.execucoes_automacao for select to authenticated
  using (public.e_membro(workspace_id));                    -- log e SO-LEITURA no painel
create policy fatos_service_role on public.fatos_automacao for all to service_role using (true) with check (true);
create policy marcas_service_role on public.automacao_marcas for all to service_role using (true) with check (true);
-- fatos_automacao e automacao_marcas: SEM policy de membro (mecanica interna, como eventos_webhook).

-- Ordem determinística de execução entre regras do mesmo gatilho.
create index automacoes_gatilho_idx on public.automacoes (workspace_id, gatilho, ordem)
  where ativo;

-- O executor carimba a origem POR NEGOCIO logo apos escrever. Este indice serve esse update
-- e a varredura de pendentes por negocio.
create index fatos_negocio_idx on public.fatos_automacao (negocio_id, criado_em)
  where processado_em is null;
