import { admin } from '@/server/supabase'



const COLS_PIPELINE = 'id, nome, ordem, is_padrao, criado_em'


const COLS_ETAPA = 'id, pipeline_id, nome, ordem, cor, sla_dias, probabilidade, criado_em'

export type Pipeline = {
  id: string
  nome: string
  ordem: number
  is_padrao: boolean
  criado_em: string
}

export type Etapa = {
  id: string
  pipeline_id: string
  nome: string
  ordem: number
  cor: string | null
  sla_dias: number | null
  probabilidade: number | null
  criado_em: string
}

export async function criarPipeline(workspaceId: string, campos: {
  nome: string
  ordem?: number
  is_padrao?: boolean
}): Promise<Pipeline> {
  const payload: Record<string, unknown> = { nome: campos.nome }
  if (campos.ordem !== undefined) payload.ordem = campos.ordem
  if (campos.is_padrao !== undefined) payload.is_padrao = campos.is_padrao
  payload.workspace_id = workspaceId
  const { data, error } = await admin()
    .from('pipelines')
    .insert(payload)
    .select(COLS_PIPELINE)
    .single()
  if (error) throw error
  return data as Pipeline
}

export async function listarPipelines(workspaceId: string): Promise<Pipeline[]> {
  const { data, error } = await admin()
    .from('pipelines')
    .select(COLS_PIPELINE)
    .eq('workspace_id', workspaceId)
    .order('ordem')
  if (error) throw error
  return (data as Pipeline[] | null) ?? []
}


export async function buscarPipelinePadrao(workspaceId: string): Promise<Pipeline | null> {
  const { data, error } = await admin()
    .from('pipelines')
    .select(COLS_PIPELINE)
    .eq('workspace_id', workspaceId)
    .eq('is_padrao', true)
    .maybeSingle()
  if (error) throw error
  return (data as Pipeline | null) ?? null
}


export async function buscarEtapa(workspaceId: string, id: string): Promise<Etapa | null> {
  const { data } = await admin()
    .from('etapas')
    .select(COLS_ETAPA)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  return (data as Etapa | null) ?? null
}

export async function criarEtapa(workspaceId: string, campos: {
  pipeline_id: string
  nome: string
  ordem: number
  cor?: string | null
}): Promise<Etapa> {
  const payload: Record<string, unknown> = {
    pipeline_id: campos.pipeline_id,
    nome: campos.nome,
    ordem: campos.ordem,
  }
  if (campos.cor !== undefined) payload.cor = campos.cor
  payload.workspace_id = workspaceId
  const { data, error } = await admin()
    .from('etapas')
    .insert(payload)
    .select(COLS_ETAPA)
    .single()
  if (error) throw error
  return data as Etapa
}

export async function listarEtapas(workspaceId: string, pipeline_id: string): Promise<Etapa[]> {
  const { data, error } = await admin()
    .from('etapas')
    .select(COLS_ETAPA)
    .eq('workspace_id', workspaceId)
    .eq('pipeline_id', pipeline_id)
    .order('ordem')
  if (error) throw error
  return (data as Etapa[] | null) ?? []
}


export async function reordenarEtapas(workspaceId: string, pipeline_id: string, ordemIds: string[]): Promise<void> {
  for (let index = 0; index < ordemIds.length; index++) {
    const id = ordemIds[index]
    const { error } = await admin()
      .from('etapas')
      .update({ ordem: index })
      .eq('id', id)
      .eq('pipeline_id', pipeline_id)
      .eq('workspace_id', workspaceId)
    if (error) throw error
  }
}
