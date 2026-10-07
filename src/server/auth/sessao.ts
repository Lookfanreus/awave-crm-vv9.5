import 'server-only'
import type { User } from '@supabase/supabase-js'
import { criarClienteServidor } from '@/server/supabase-session'



type ResultadoEntrar = { ok: true } | { erro: string }
type ResultadoSair = { ok: true } | { erro: string }

export async function entrar({ email, senha }: { email: string; senha: string }): Promise<ResultadoEntrar> {
  const sessao = await criarClienteServidor()
  const { data, error } = await sessao.auth.signInWithPassword({ email, password: senha })
  if (error || !data?.user) return { erro: 'credenciais_invalidas' }
  return { ok: true }
}

export async function sair(): Promise<ResultadoSair> {
  const sessao = await criarClienteServidor()
  const { error } = await sessao.auth.signOut()
  if (error) return { erro: 'falha_sair' }
  return { ok: true }
}


export async function exigirSessao(): Promise<User> {
  const sessao = await criarClienteServidor()
  const { data: { user } } = await sessao.auth.getUser()
  if (!user) {
    const { redirect } = await import('next/navigation')
    redirect('/entrar') 
    throw new Error('redirect não interrompeu o fluxo')
  }
  return user
}
