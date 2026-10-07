import type { SupabaseClient } from '@supabase/supabase-js'


export async function resolverMembroAtivo(
  { cliente, ws }: { cliente: SupabaseClient; ws: string },
): Promise<string | null> {
  const { data: { user } } = await cliente.auth.getUser()
  if (!user) return null
  const { data, error } = await cliente
    .from('membros').select('id').eq('workspace_id', ws).eq('user_id', user.id).maybeSingle()
  if (error) throw error
  return (data as { id: string } | null)?.id ?? null
}
