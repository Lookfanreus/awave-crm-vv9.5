import 'server-only'
import { criarClienteServidor } from '@/server/supabase-session'


export async function ehOwnerDoWorkspace(ws: string): Promise<boolean> {
  const sessao = await criarClienteServidor()
  const {
    data: { user },
  } = await sessao.auth.getUser()
  if (!user) return false

  const { data } = await sessao
    .from('membros')
    .select('id')
    .eq('workspace_id', ws)
    .eq('user_id', user.id)
    .eq('papel', 'owner')
    .maybeSingle()
  return Boolean(data)
}
