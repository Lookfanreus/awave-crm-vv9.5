-- 0008_webhook_grants_fix.sql — completa os grants das funções do webhook de saída.
-- Revoga EXECUTE de `authenticated` em enfileirar_evento e reservar_eventos: as duas são
-- SECURITY DEFINER e só devem ser chamadas pelo processo interno (service_role, via
-- `grant` explícito na 0007). No Supabase, ALTER DEFAULT PRIVILEGES concede EXECUTE a
-- `authenticated` na CRIAÇÃO da função — revogar de `public, anon` não tira esse grant.
-- Aditivo; roda logo após a 0007, no mesmo boot.
revoke all on function public.enfileirar_evento(text, uuid, jsonb) from authenticated;
revoke all on function public.reservar_eventos(int, interval)      from authenticated;
