-- 0001_vault.sql — Vault do CRM (BYO secrets do comprador). Espelha os RPCs genericos
-- do Motor (0005_config.sql): SECURITY DEFINER, so service_role, delegam ao supabase_vault.
create extension if not exists supabase_vault with schema vault;

create table if not exists public.settings (
  key text primary key,
  value text
);
alter table public.settings enable row level security;

-- set_secret: assinatura FIEL ao Motor (0005_config.sql:17-42) — passa o key_id explicito
-- no update pra PRESERVAR a chave de criptografia (a versao de 2 args pode perde-la).
create or replace function public.set_secret(p_name text, p_value text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_key_id uuid;
begin
  select id, key_id into v_id, v_key_id from vault.secrets where name = p_name limit 1;
  if v_id is not null then
    perform vault.update_secret(v_id, p_value, p_name, null, v_key_id);
  else
    perform vault.create_secret(p_value, p_name);
  end if;
end $$;

create or replace function public.get_secret(p_name text)
returns text language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

create or replace function public.delete_secret(p_name text)
returns void language sql security definer set search_path = '' as $$
  delete from vault.secrets where name = p_name;
$$;

-- Gate de configuração do CRM (o do Motor checa chaves dele; aqui e stub aditivo p/ fatias futuras).
create or replace function public.crm_is_configured()
returns boolean language sql security definer set search_path = '' as $$
  select true;
$$;

revoke all on function public.set_secret(text, text) from public, anon, authenticated;
revoke all on function public.get_secret(text) from public, anon, authenticated;
revoke all on function public.delete_secret(text) from public, anon, authenticated;
revoke all on function public.crm_is_configured() from public, anon, authenticated;
grant execute on function public.set_secret(text, text) to service_role;
grant execute on function public.get_secret(text) to service_role;
grant execute on function public.delete_secret(text) to service_role;
grant execute on function public.crm_is_configured() to service_role;

create policy "settings_service_role" on public.settings
  for all to service_role using (true) with check (true);
