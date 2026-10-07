'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { salvarRelatorio, excluirRelatorio } from '@/server/crm/relatorios'
import type { ConfigRelatorio } from '@/lib/relatorios'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { admin } from '@/server/supabase'



type Res = { ok: true } | { erro: string }
type ResId = { ok: true; id: string } | { erro: string }

async function sessaoEws() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  return { cliente, ws }
}

export async function salvarNovoRelatorio(
  entrada: { nome: string; tipo: string; config: ConfigRelatorio },
): Promise<ResId> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  
  
  const { data: { user } } = await cliente.auth.getUser()
  return salvarRelatorio(admin(), ws, { ...entrada, criadoPor: user?.id ?? null })
}

export async function salvarEdicaoRelatorio(
  entrada: { id: string; nome: string; tipo: string; config: ConfigRelatorio },
): Promise<ResId> {
  await exigirEngineLiberado()
  const { ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  return salvarRelatorio(admin(), ws, entrada)
}

export async function removerRelatorio(id: string): Promise<Res> {
  await exigirEngineLiberado()
  const { ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  return excluirRelatorio(admin(), ws, id)
}
