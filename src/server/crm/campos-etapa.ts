'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { lerRegrasEtapa, umEmbed } from '@/server/crm/campos-leitura'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { admin } from '@/server/supabase'
import { detalheSeguro } from '@/lib/sanitizar-erro'



type Res = { ok: true } | { erro: string }
export type RegraEtapa = { campo_id: string; etapa_id: string; obrigatorio: boolean; visivel: boolean }

async function sessaoEws() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  return { cliente, ws }
}

export async function listarRegrasDoFunil(pipelineId: string): Promise<RegraEtapa[]> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return []
  const { data: etapas } = await cliente.from('etapas')
    .select('id').eq('workspace_id', ws).eq('pipeline_id', pipelineId)
  const ids = ((etapas as { id: string }[] | null) ?? []).map((e) => e.id)
  if (ids.length === 0) return []
  const { data, error } = await cliente.from('campos_etapa')
    .select('campo_id, etapa_id, obrigatorio, visivel')
    .eq('workspace_id', ws).in('etapa_id', ids)
  if (error) throw error
  return (data as RegraEtapa[] | null) ?? []
}


export async function definirRegra(input: {
  campoId: string; etapaId: string; obrigatorio: boolean; visivel: boolean
}): Promise<Res> {
  await exigirEngineLiberado()
  if (input.obrigatorio && !input.visivel) return { erro: 'invisivel_obrigatorio' }
  const { ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { error } = await admin().from('campos_etapa').upsert({
      workspace_id: ws, campo_id: input.campoId, etapa_id: input.etapaId,
      obrigatorio: input.obrigatorio, visivel: input.visivel,
    }, { onConflict: 'campo_id,etapa_id' })
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[campos-etapa] definir', detalheSeguro(err)); return { erro: 'falha_definir' } }
}


export async function regrasDaEtapa(
  etapaId: string,
): Promise<{ obrigatorios: string[]; invisiveis: string[]; rotulos: Record<string, string> }> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { obrigatorios: [], invisiveis: [], rotulos: {} }
  return lerRegrasEtapa(cliente, ws, etapaId)
}


export async function camposObrigatoriosDaEtapa(etapaId: string): Promise<string[]> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return []
  const { data, error } = await cliente.from('campos_etapa')
    .select('obrigatorio, campos_def!campos_etapa_campo_fk(slug, ativo)')
    .eq('workspace_id', ws).eq('etapa_id', etapaId).eq('obrigatorio', true)
  if (error) throw error
  const linhas = ((data ?? []) as Array<{ obrigatorio: boolean; campos_def: unknown }>)
  return linhas
    .map((l) => umEmbed<{ slug: string; ativo: boolean }>(l.campos_def))
    .filter((c): c is { slug: string; ativo: boolean } => !!c && c.ativo)
    .map((c) => c.slug)
}
