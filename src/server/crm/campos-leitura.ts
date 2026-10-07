import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { aplicarPatch, type DefCampo } from '@/lib/campos-valor'
import type { Entidade } from '@/server/crm/campos-def'




export type DefCampoUI = DefCampo & { rotulo: string }

type LinhaDef = { pipeline_id?: string | null }


function aplicavel(d: LinhaDef, pipelineId?: string): boolean {
  return d.pipeline_id == null || d.pipeline_id === pipelineId
}


export async function lerDefs(
  cliente: SupabaseClient,
  ws: string,
  entidade: Entidade,
  pipelineId?: string,
): Promise<DefCampo[]> {
  const { data, error } = await cliente
    .from('campos_def')
    .select('slug, tipo, opcoes, config, pipeline_id')
    .eq('workspace_id', ws)
    .eq('entidade', entidade)
    .eq('ativo', true)
  if (error) throw error
  const linhas = (data as Array<DefCampo & LinhaDef> | null) ?? []
  return linhas
    .filter((d) => aplicavel(d, pipelineId))
    .map(({ pipeline_id: _ignorado, ...def }) => def)
}


export async function lerDefsUI(
  cliente: SupabaseClient,
  ws: string,
  entidade: Entidade,
  pipelineId?: string,
): Promise<DefCampoUI[]> {
  const { data, error } = await cliente
    .from('campos_def')
    .select('slug, rotulo, tipo, opcoes, config, pipeline_id')
    .eq('workspace_id', ws)
    .eq('entidade', entidade)
    .eq('ativo', true)
    .order('ordem')
  if (error) throw error
  const linhas = (data as Array<DefCampoUI & LinhaDef> | null) ?? []
  return linhas
    .filter((d) => aplicavel(d, pipelineId))
    .map(({ pipeline_id: _ignorado, ...def }) => def)
}


export function umEmbed<T>(x: unknown): T | undefined {
  return (Array.isArray(x) ? x[0] : x) as T | undefined
}


export async function lerRegrasEtapa(
  cliente: SupabaseClient,
  ws: string,
  etapaId: string,
): Promise<{ obrigatorios: string[]; invisiveis: string[]; rotulos: Record<string, string> }> {
  const { data, error } = await cliente.from('campos_etapa')
    .select('obrigatorio, visivel, campos_def!campos_etapa_campo_fk(slug, rotulo, ativo)')
    .eq('workspace_id', ws).eq('etapa_id', etapaId)
  if (error) throw error
  const linhas = ((data ?? []) as Array<{ obrigatorio: boolean; visivel: boolean; campos_def: unknown }>)
  const obrigatorios: string[] = []
  const invisiveis: string[] = []
  
  
  const rotulos: Record<string, string> = {}
  for (const l of linhas) {
    const def = umEmbed<{ slug: string; rotulo: string; ativo: boolean }>(l.campos_def)
    if (!def?.ativo) continue
    rotulos[def.slug] = def.rotulo
    if (l.obrigatorio) obrigatorios.push(def.slug)
    if (!l.visivel) invisiveis.push(def.slug)
  }
  return { obrigatorios, invisiveis, rotulos }
}


export async function mesclarCampos(
  cliente: SupabaseClient,
  ws: string,
  entidade: Entidade,
  atual: Record<string, unknown>,
  patch: Record<string, unknown>,
  pipelineId?: string,
): Promise<{ ok: true; campos: Record<string, unknown> } | { ok: false; slugs: string[] }> {
  if (Object.keys(patch).length === 0) return { ok: true, campos: atual }
  const defs = await lerDefs(cliente, ws, entidade, pipelineId)
  const r = aplicarPatch(defs, atual, patch)
  if (!r.ok) return { ok: false, slugs: r.erros.map((e) => e.slug) }
  return { ok: true, campos: r.campos }
}
