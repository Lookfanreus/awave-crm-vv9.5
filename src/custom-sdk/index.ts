import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { exigirSessao } from '@/server/auth/sessao'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { criarClienteServidor } from '@/server/supabase-session'



export type Sessao = {
  userId: string
  email: string
  
  workspaceId: string
}


export async function usarSessao(): Promise<Sessao> {
  const user = await exigirSessao()
  const workspaceId = await resolverWorkspaceAtivo()
  if (!workspaceId) {
    const { redirect } = await import('next/navigation')
    redirect('/sem-workspace') 
    throw new Error('redirect não interrompeu o fluxo')
  }
  return { userId: user.id, email: user.email ?? '', workspaceId }
}


export async function clienteDaSessao(): Promise<SupabaseClient> {
  return criarClienteServidor()
}
