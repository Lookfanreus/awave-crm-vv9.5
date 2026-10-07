import 'server-only'
import { randomBytes } from 'node:crypto'
import { admin } from '@/server/supabase'
import { criarClienteServidor } from '@/server/supabase-session'



const DIAS = 7
const MS_POR_DIA = 24 * 60 * 60 * 1000

type ResultadoCriar = { link: string } | { erro: string }
type ResultadoAceitar = { ok: true; workspaceId: string } | { erro: string }

export async function criarConvite({ workspaceId, papel, email }: {
  workspaceId: string
  papel: 'owner' | 'membro'
  email?: string
}): Promise<ResultadoCriar> {
  
  const sessao = await criarClienteServidor()
  const { data: { user } } = await sessao.auth.getUser()
  if (!user) return { erro: 'nao_autorizado' }

  
  const db = admin()
  const { data: eOwner, error: eCheck } = await db
    .from('membros')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('papel', 'owner')
    .maybeSingle()
  if (eCheck) return { erro: 'nao_autorizado' }
  if (!eOwner) return { erro: 'nao_autorizado' }

  
  const token = randomBytes(24).toString('hex')
  const expira_em = new Date(Date.now() + DIAS * MS_POR_DIA).toISOString()
  const { error } = await db
    .from('convites')
    .insert({ workspace_id: workspaceId, papel, email: email ?? null, token, expira_em, criado_por: user.id })
    .select('token')
    .single()
  if (error) return { erro: 'falha_criar_convite' }

  return { link: '/convite/' + token }
}


export async function conviteEhValido(token: string): Promise<boolean> {
  if (!token) return false
  const { data, error } = await admin()
    .from('convites')
    .select('id')
    .eq('token', token)
    .is('aceito_em', null)
    .gt('expira_em', new Date().toISOString())
    .maybeSingle()
  return !error && Boolean(data)
}

export async function aceitarConvite(token: string): Promise<ResultadoAceitar> {
  
  const sessao = await criarClienteServidor()
  const { data: wsId, error } = await sessao.rpc('aceitar_convite', { p_token: token })
  if (error || !wsId) return { erro: 'convite_invalido' }
  return { ok: true, workspaceId: wsId as string }
}
