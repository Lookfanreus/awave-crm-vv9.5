import 'server-only'
import { admin } from '@/server/supabase'

export type CredencialRef = { workspace_id: string; revogado_em: string | null }


export async function buscarCredencialPorKeyId(keyId: string): Promise<CredencialRef | null> {
  const { data } = await admin()
    .from('credenciais_api')
    .select('workspace_id, revogado_em')
    .eq('key_id', keyId)
    .maybeSingle()
  return (data as CredencialRef | null) ?? null
}
