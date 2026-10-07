import { admin } from '@/server/supabase'
import { buscarPipelinePadrao, listarEtapas } from '@/server/crm/pipelines'
import { mesclarCampos } from '@/server/crm/campos-leitura'
import { camposFaltantes, avancou } from '@/lib/gate-campos'
import {
  CrmSemPipelinePadrao,
  CrmEtapaDeOutroPipeline,
  CrmNegocioNaoEncontrado,
  CrmEtapaNaoEncontrada,
  CrmCamposInvalidos,
  CrmCamposObrigatorios,
  CrmNegocioTituloObrigatorio,
} from '@/server/crm/erros'





const COLS =
  'id, titulo, valor, moeda, status, motivo_perda, ordem, responsavel_id, chave_externa, contato_id, empresa_id, pipeline_id, etapa_id, campos, etapa_desde, previsao_fechamento, criado_em, atualizado_em, fechado_em'

export type StatusNegocio = 'aberto' | 'ganho' | 'perdido'

export type Negocio = {
  id: string
  titulo: string
  valor: string | null
  moeda: string
  status: StatusNegocio
  motivo_perda: string | null
  ordem: number
  responsavel_id: string | null
  chave_externa: string | null
  contato_id: string | null
  empresa_id: string | null
  pipeline_id: string
  etapa_id: string
  campos: Record<string, unknown>
  etapa_desde: string
  
  previsao_fechamento: string | null
  criado_em: string
  atualizado_em: string
  fechado_em: string | null
}


type CamposNegocio = {
  titulo?: string
  valor?: string | number | null
  moeda?: string
  responsavel_id?: string | null
  contato_id?: string | null
  empresa_id?: string | null
  
  previsao_fechamento?: string | null
}

function patchPermitido(campos: CamposNegocio): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (campos.titulo !== undefined) patch.titulo = campos.titulo
  if (campos.valor !== undefined) patch.valor = campos.valor
  if (campos.moeda !== undefined) patch.moeda = campos.moeda
  if (campos.responsavel_id !== undefined) patch.responsavel_id = campos.responsavel_id
  if (campos.contato_id !== undefined) patch.contato_id = campos.contato_id
  if (campos.empresa_id !== undefined) patch.empresa_id = campos.empresa_id
  if (campos.previsao_fechamento !== undefined) patch.previsao_fechamento = campos.previsao_fechamento
  return patch
}


async function resolverCampos(
  workspaceId: string,
  atual: Record<string, unknown>,
  patch: Record<string, unknown> | undefined,
  pipelineId?: string,
): Promise<Record<string, unknown> | undefined> {
  if (!patch) return undefined
  const r = await mesclarCampos(admin(), workspaceId, 'negocio', atual, patch, pipelineId)
  if (!r.ok) throw new CrmCamposInvalidos(r.slugs)
  return r.campos
}


async function obrigatoriosDaEtapaAdmin(workspaceId: string, etapaId: string): Promise<string[]> {
  const { data, error } = await admin().from('campos_etapa')
    .select('obrigatorio, campos_def!campos_etapa_campo_fk(slug, ativo)')
    .eq('workspace_id', workspaceId).eq('etapa_id', etapaId).eq('obrigatorio', true)
  if (error) throw error
  return ((data ?? []) as Array<{ campos_def: unknown }>)
    .map((l) => (Array.isArray(l.campos_def) ? l.campos_def[0] : l.campos_def) as { slug: string; ativo: boolean } | undefined)
    .filter((d): d is { slug: string; ativo: boolean } => !!d && d.ativo)
    .map((d) => d.slug)
}


async function assertGate(workspaceId: string, negocio: Negocio, ordemDestino: number): Promise<void> {
  
  
  const { data: origem, error: eOrigem } = await admin().from('etapas')
    .select('ordem').eq('workspace_id', workspaceId).eq('id', negocio.etapa_id).maybeSingle()
  if (eOrigem) throw eOrigem
  const ordemOrigem = (origem as { ordem: number } | null)?.ordem ?? 0
  if (!avancou(ordemOrigem, ordemDestino)) return
  const obrigatorios = await obrigatoriosDaEtapaAdmin(workspaceId, negocio.etapa_id)
  const faltando = camposFaltantes(obrigatorios, negocio.campos ?? {})
  if (faltando.length) throw new CrmCamposObrigatorios(faltando)
}


async function proximaOrdem(workspaceId: string, etapaId: string): Promise<number> {
  const { data, error } = await admin()
    .from('negocios')
    .select('ordem')
    .eq('workspace_id', workspaceId)
    .eq('etapa_id', etapaId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const linha = data as { ordem: number } | null
  return (linha?.ordem ?? -1) + 1
}

export async function criarNegocio(workspaceId: string, dados: {
  titulo: string
  valor?: string | number | null
  moeda?: string
  responsavel_id?: string | null
  contato_id?: string | null
  empresa_id?: string | null
  chave_externa?: string | null
  pipeline_id?: string
  etapa_id?: string
  
  campos?: Record<string, unknown>
}): Promise<Negocio> {
  let pipelineId = dados.pipeline_id
  let etapaId = dados.etapa_id

  
  
  if (!pipelineId || !etapaId) {
    const padrao = await buscarPipelinePadrao(workspaceId)
    if (!padrao) throw new CrmSemPipelinePadrao()
    pipelineId = padrao.id
    const etapas = await listarEtapas(workspaceId, padrao.id)
    etapaId = etapas[0]?.id
    
    
    if (!etapaId) throw new CrmSemPipelinePadrao()
  }

  const ordem = await proximaOrdem(workspaceId, etapaId as string)

  const payload = patchPermitido(dados)
  payload.titulo = dados.titulo 
  if (dados.chave_externa !== undefined) payload.chave_externa = dados.chave_externa
  payload.pipeline_id = pipelineId
  payload.etapa_id = etapaId
  payload.ordem = ordem
  payload.workspace_id = workspaceId

  
  const camposFinal = await resolverCampos(workspaceId, {}, dados.campos, pipelineId)
  if (camposFinal !== undefined) payload.campos = camposFinal

  const { data, error } = await admin()
    .from('negocios')
    .insert(payload)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Negocio
}

export async function atualizarNegocio(
  workspaceId: string,
  id: string,
  dados: CamposNegocio & { campos?: Record<string, unknown> },
): Promise<Negocio | null> {
  const patch = patchPermitido(dados)
  if (Object.keys(patch).length === 0 && !dados.campos) return buscarNegocio(workspaceId, id)

  if (dados.campos) {
    
    const atual = await buscarNegocio(workspaceId, id)
    if (!atual) throw new CrmNegocioNaoEncontrado()
    patch.campos = await resolverCampos(workspaceId, atual.campos ?? {}, dados.campos, atual.pipeline_id)
  }

  const { data, error } = await admin()
    .from('negocios')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Negocio
}

export async function buscarNegocio(workspaceId: string, id: string): Promise<Negocio | null> {
  const { data, error } = await admin()
    .from('negocios')
    .select(COLS)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) throw error
  return (data as Negocio | null) ?? null
}


export async function moverParaEtapa(workspaceId: string, negocioId: string, { etapaId }: { etapaId: string }): Promise<void> {
  const negocio = await buscarNegocio(workspaceId, negocioId)
  if (!negocio) throw new CrmNegocioNaoEncontrado()

  const { data: etapa, error: erroEtapa } = await admin()
    .from('etapas')
    .select('pipeline_id, ordem')
    .eq('id', etapaId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (erroEtapa) throw erroEtapa
  const etapaAlvo = etapa as { pipeline_id: string; ordem: number } | null
  if (!etapaAlvo) throw new CrmEtapaNaoEncontrada()

  if (etapaAlvo.pipeline_id !== negocio.pipeline_id) throw new CrmEtapaDeOutroPipeline()

  await assertGate(workspaceId, negocio, etapaAlvo.ordem)

  const ordem = await proximaOrdem(workspaceId, etapaId)

  const { error } = await admin()
    .from('negocios')
    .update({ etapa_id: etapaId, ordem })
    .eq('id', negocioId)
    .eq('workspace_id', workspaceId)
  if (error) throw error
}

export async function listarPorEtapa(
  workspaceId: string,
  etapaId: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Negocio[]> {
  const { data, error } = await admin()
    .from('negocios')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .eq('etapa_id', etapaId)
    .order('ordem')
    .order('criado_em')
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data as Negocio[] | null) ?? []
}

export async function listarPorPipeline(
  workspaceId: string,
  pipeline_id: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Negocio[]> {
  const { data, error } = await admin()
    .from('negocios')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .eq('pipeline_id', pipeline_id)
    .order('ordem')
    .order('criado_em')
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data as Negocio[] | null) ?? []
}


export async function ganhar(workspaceId: string, negocioId: string): Promise<Negocio> {
  const negocio = await buscarNegocio(workspaceId, negocioId)
  if (!negocio) throw new CrmNegocioNaoEncontrado()
  const obrigatorios = await obrigatoriosDaEtapaAdmin(workspaceId, negocio.etapa_id)
  const faltando = camposFaltantes(obrigatorios, negocio.campos ?? {})
  if (faltando.length) throw new CrmCamposObrigatorios(faltando)

  const { data, error } = await admin()
    .from('negocios')
    .update({ status: 'ganho', fechado_em: new Date().toISOString() })
    .eq('id', negocioId)
    .eq('workspace_id', workspaceId)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Negocio
}

export async function perder(workspaceId: string, negocioId: string, motivo: string): Promise<Negocio> {
  const { data, error } = await admin()
    .from('negocios')
    .update({ status: 'perdido', motivo_perda: motivo, fechado_em: new Date().toISOString() })
    .eq('id', negocioId)
    .eq('workspace_id', workspaceId)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Negocio
}


export async function buscarPorChaveExterna(workspaceId: string, chave: string): Promise<Negocio | null> {
  const { data, error } = await admin()
    .from('negocios')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .eq('chave_externa', chave)
    .maybeSingle()
  if (error) throw error
  return (data as Negocio | null) ?? null
}


export async function upsertPorChaveExterna(workspaceId: string, a: {
  chave_externa: string
  titulo?: string
  valor?: string | number | null
  moeda?: string
  responsavel_id?: string | null
  contato_id?: string | null
  empresa_id?: string | null
  campos?: Record<string, unknown>
}): Promise<Negocio> {
  const { chave_externa, ...dados } = a
  const patch = patchPermitido(dados)

  const existente = await buscarPorChaveExterna(workspaceId, chave_externa)

  if (existente) {
    
    
    const camposFinal = await resolverCampos(
      workspaceId, existente.campos ?? {}, dados.campos, existente.pipeline_id,
    )
    if (camposFinal !== undefined) patch.campos = camposFinal
    const { data, error } = await admin()
      .from('negocios')
      .update(patch)
      .eq('id', existente.id)
      .eq('workspace_id', workspaceId)
      .select(COLS)
      .single()
    if (error) throw error
    return data as Negocio
  }

  
  
  
  
  if (!dados.titulo) throw new CrmNegocioTituloObrigatorio()
  return criarNegocio(workspaceId, { ...dados, titulo: dados.titulo, chave_externa })
}
