'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { admin } from '@/server/supabase'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { slugTipo } from '@/lib/slug'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { detalheSeguro } from '@/lib/sanitizar-erro'



type Res = { ok: true } | { erro: string }

export type TipoCompleto = {
  id: string; slug: string; nome: string; icone: string
  natureza: 'atividade' | 'nota' | 'sistema'; ordem: number; bloqueado: boolean; ativo: boolean
  uso: number
}

async function sessaoEws() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  return { cliente, ws }
}


async function bloqueadoDoTipo(cliente: Awaited<ReturnType<typeof criarClienteServidor>>, ws: string, id: string) {
  const { data } = await cliente.from('tipos_atividade')
    .select('bloqueado').eq('workspace_id', ws).eq('id', id).maybeSingle()
  return (data as { bloqueado: boolean } | null)
}


export async function listarTiposCompleto(): Promise<TipoCompleto[]> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return []
  const { data, error } = await cliente.from('tipos_atividade')
    .select('id, slug, nome, icone, natureza, ordem, bloqueado, ativo')
    .eq('workspace_id', ws).order('ordem')
  if (error) throw error
  const tipos = (data as Omit<TipoCompleto, 'uso'>[] | null) ?? []

  
  const { data: usos } = await cliente.from('atividades')
    .select('tipo_id').eq('workspace_id', ws)
  const cont = new Map<string, number>()
  for (const u of (usos as { tipo_id: string }[] | null) ?? []) cont.set(u.tipo_id, (cont.get(u.tipo_id) ?? 0) + 1)
  return tipos.map((t) => ({ ...t, uso: cont.get(t.id) ?? 0 }))
}

export async function criarTipo({ nome }: { nome: string }): Promise<Res> {
  await exigirEngineLiberado()
  const limpo = nome.trim()
  if (!limpo) return { erro: 'nome_vazio' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: existentes } = await cliente.from('tipos_atividade')
      .select('slug, ordem').eq('workspace_id', ws)
    const linhas = (existentes as { slug: string; ordem: number }[] | null) ?? []
    const slug = slugTipo(limpo, linhas.map((l) => l.slug))
    const ordem = linhas.reduce((max, l) => Math.max(max, l.ordem), -1) + 1
    const { error } = await admin().from('tipos_atividade').insert({
      workspace_id: ws, slug, nome: limpo, icone: 'Circle', natureza: 'atividade',
      bloqueado: false, ativo: true, ordem,
    })
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[tipos] criar', detalheSeguro(err)); return { erro: 'falha_criar' } }
}

export async function renomearTipo({ id, nome }: { id: string; nome: string }): Promise<Res> {
  await exigirEngineLiberado()
  const limpo = nome.trim()
  if (!limpo) return { erro: 'nome_vazio' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const t = await bloqueadoDoTipo(cliente, ws, id)
    if (!t) return { erro: 'nao_encontrado' }
    if (t.bloqueado) return { erro: 'bloqueado' }
    const { error } = await admin().from('tipos_atividade')
      .update({ nome: limpo }).eq('workspace_id', ws).eq('id', id)  
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[tipos] renomear', detalheSeguro(err)); return { erro: 'falha_renomear' } }
}

async function setAtivo(id: string, ativo: boolean, tag: string): Promise<Res> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const t = await bloqueadoDoTipo(cliente, ws, id)
    if (!t) return { erro: 'nao_encontrado' }
    if (t.bloqueado) return { erro: 'bloqueado' }
    const { error } = await admin().from('tipos_atividade')
      .update({ ativo }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error(`[tipos] ${tag}`, detalheSeguro(err)); return { erro: `falha_${tag}` } }
}





export async function arquivarTipo({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  return setAtivo(id, false, 'arquivar')
}
export async function reativarTipo({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  return setAtivo(id, true, 'reativar')
}

export async function excluirTipo({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const t = await bloqueadoDoTipo(cliente, ws, id)
    if (!t) return { erro: 'nao_encontrado' }
    if (t.bloqueado) return { erro: 'bloqueado' }
    
    const { count } = await cliente.from('atividades')
      .select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('tipo_id', id)
    if ((count ?? 0) > 0) return { erro: 'em_uso' }
    const { error } = await admin().from('tipos_atividade')
      .delete().eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[tipos] excluir', detalheSeguro(err)); return { erro: 'falha_excluir' } }
}
