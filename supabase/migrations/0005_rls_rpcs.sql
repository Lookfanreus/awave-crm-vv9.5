-- 0005_rls_rpcs.sql — RLS workspace-scoped + as RPCs de tenancy.
-- Helpers SECURITY DEFINER (bypassam RLS -> sem recursao de policy-em-membros).

-- == helpers ================================================================
create or replace function public.e_membro(ws uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.membros m where m.workspace_id = ws and m.user_id = auth.uid());
$$;
create or replace function public.e_owner(ws uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.membros m where m.workspace_id = ws and m.user_id = auth.uid() and m.papel = 'owner');
$$;
revoke all on function public.e_membro(uuid) from public, anon;
revoke all on function public.e_owner(uuid)  from public, anon;
grant execute on function public.e_membro(uuid) to authenticated, service_role;
grant execute on function public.e_owner(uuid)  to authenticated, service_role;

-- == policies workspace-scoped (authenticated) nas 6 tabelas ================
-- (as policies service_role do 0002 seguem; estas ADICIONAM o acesso do usuario logado)
create policy empresas_membro   on public.empresas   for all to authenticated using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
create policy contatos_membro   on public.contatos   for all to authenticated using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
create policy pipelines_membro  on public.pipelines  for all to authenticated using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
create policy etapas_membro     on public.etapas     for all to authenticated using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
create policy negocios_membro   on public.negocios   for all to authenticated using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
create policy atividades_membro on public.atividades for all to authenticated using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));

-- == workspaces / membros / convites (authenticated) =======================
create policy workspaces_sel on public.workspaces for select to authenticated using (public.e_membro(id));
create policy workspaces_upd on public.workspaces for update to authenticated using (public.e_owner(id)) with check (public.e_owner(id));
create policy workspaces_del on public.workspaces for delete to authenticated using (public.e_owner(id));
-- INSERT em workspaces so via criar_workspace (SECURITY DEFINER) — sem policy authenticated.

create policy membros_sel on public.membros for select to authenticated using (public.e_membro(workspace_id));
create policy membros_del on public.membros for delete to authenticated using (public.e_owner(workspace_id));
-- INSERT via RPC (criar_workspace/aceitar_convite); UPDATE de papel = 1c.

create policy convites_all on public.convites for all to authenticated using (public.e_owner(workspace_id)) with check (public.e_owner(workspace_id));

-- == RPC: criar workspace + provisionar funil padrao =======================
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
  return v_ws;
end $$;
revoke all on function public.criar_workspace(text, uuid) from public, anon;
grant execute on function public.criar_workspace(text, uuid) to authenticated, service_role;

-- == RPC: aceitar convite (consome atomico; tolera ja-membro) ==============
create or replace function public.aceitar_convite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ws uuid; v_papel text;
begin
  if auth.uid() is null then raise exception 'sem sessao'; end if;
  update public.convites set aceito_em = now(), aceito_por = auth.uid()
    where token = p_token and aceito_em is null and expira_em > now()
    returning workspace_id, papel into v_ws, v_papel;
  if v_ws is null then raise exception 'convite invalido'; end if;
  insert into public.membros (workspace_id, user_id, papel) values (v_ws, auth.uid(), v_papel)
    on conflict (workspace_id, user_id) do nothing;
  return v_ws;
end $$;
revoke all on function public.aceitar_convite(text) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated, service_role;
