import 'server-only'
import { admin } from '@/server/supabase'
import { validarForma, type Regra, type ItemAcao } from '@/lib/automacao-forma'
import { CrmAutomacaoInvalida, CrmAutomacaoAlvoInvalido } from '@/server/crm/erros'




const COLS =
  'id, pipeline_id, nome, ativo, gatilho, gatilho_config, condicoes, acoes, ordem, criado_em, atualizado_em'


const COLS_EXECUCOES =
  'id, automacao_id, negocio_id, fato_id, estado, tentativas, proxima_tentativa, ultimo_erro, resultado, criado_em, executado_em'


export type EstadoExecucao = 'pendente' | 'ok' | 'erro' | 'desistido' | 'cancelado'

export type Automacao = {
  id: string
  pipeline_id: string | null
  nome: string
  ativo: boolean
  gatilho: string
  gatilho_config: Record<string, unknown>
  condicoes: unknown
  acoes: ItemAcao[]
  ordem: number
  criado_em: string
  atualizado_em: string
}

export type Execucao = {
  id: string
  automacao_id: string
  negocio_id: string | null
  fato_id: string | null
  estado: EstadoExecucao
  tentativas: number
  proxima_tentativa: string
  ultimo_erro: string | null
  resultado: unknown
  criado_em: string
  executado_em: string | null
}


export type NovaAutomacao = Regra & { pipeline_id?: string | null; ordem?: number }
export type PatchAutomacao = Partial<Pick<Regra, 'nome' | 'gatilho' | 'gatilho_config' | 'condicoes' | 'acoes'>>
  & { pipeline_id?: string | null; ordem?: number }


async function validarAlvos(workspaceId: string, acoes: ItemAcao[]): Promise<void> {
  for (const acao of acoes) {
    if (acao.tipo !== 'mover_etapa' && acao.tipo !== 'criar_negocio') continue

    const etapaId = acao.etapa_id
    if (typeof etapaId === 'string' && etapaId) {
      const { data, error } = await admin()
        .from('etapas')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('id', etapaId)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new CrmAutomacaoAlvoInvalido()
    }

    const pipelineId = acao.pipeline_id
    if (typeof pipelineId === 'string' && pipelineId) {
      const { data, error } = await admin()
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('id', pipelineId)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new CrmAutomacaoAlvoInvalido()
    }
  }
}

export async function listarAutomacoes(workspaceId: string): Promise<Automacao[]> {
  const { data, error } = await admin()
    .from('automacoes')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .order('ordem')
  if (error) throw error
  return (data as Automacao[] | null) ?? []
}

export async function buscarAutomacao(workspaceId: string, id: string): Promise<Automacao | null> {
  const { data, error } = await admin()
    .from('automacoes')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as Automacao | null) ?? null
}


export async function criarAutomacao(workspaceId: string, regra: NovaAutomacao): Promise<Automacao> {
  const erros = validarForma(regra)
  if (erros.length) throw new CrmAutomacaoInvalida(erros)

  await validarAlvos(workspaceId, regra.acoes)

  const payload: Record<string, unknown> = {
    workspace_id: workspaceId,
    nome: regra.nome,
    gatilho: regra.gatilho,
    gatilho_config: regra.gatilho_config ?? {},
    condicoes: regra.condicoes ?? null,
    acoes: regra.acoes,
    ativo: false, 
  }
  if (regra.pipeline_id !== undefined) payload.pipeline_id = regra.pipeline_id
  if (regra.ordem !== undefined) payload.ordem = regra.ordem

  const { data, error } = await admin()
    .from('automacoes')
    .insert(payload)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Automacao
}


export async function atualizarAutomacao(
  workspaceId: string,
  id: string,
  patch: PatchAutomacao,
): Promise<Automacao | null> {
  const atual = await buscarAutomacao(workspaceId, id)
  if (!atual) return null

  const mesclada: Regra = {
    nome: patch.nome ?? atual.nome,
    gatilho: patch.gatilho ?? atual.gatilho,
    gatilho_config: patch.gatilho_config ?? atual.gatilho_config,
    condicoes: patch.condicoes !== undefined ? patch.condicoes : atual.condicoes,
    acoes: patch.acoes ?? atual.acoes,
  }
  const erros = validarForma(mesclada)
  if (erros.length) throw new CrmAutomacaoInvalida(erros)
  if (patch.acoes) await validarAlvos(workspaceId, patch.acoes)

  const campos: Record<string, unknown> = {}
  if (patch.nome !== undefined) campos.nome = patch.nome
  if (patch.gatilho !== undefined) campos.gatilho = patch.gatilho
  if (patch.gatilho_config !== undefined) campos.gatilho_config = patch.gatilho_config
  if (patch.condicoes !== undefined) campos.condicoes = patch.condicoes
  if (patch.acoes !== undefined) campos.acoes = patch.acoes
  if (patch.pipeline_id !== undefined) campos.pipeline_id = patch.pipeline_id
  if (patch.ordem !== undefined) campos.ordem = patch.ordem
  if (Object.keys(campos).length === 0) return atual 

  const { data, error } = await admin()
    .from('automacoes')
    .update(campos)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Automacao
}


export async function alternarAtiva(workspaceId: string, id: string, ativo: boolean): Promise<void> {
  const { error } = await admin()
    .from('automacoes')
    .update({ ativo })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
  if (error) throw error
}

export async function excluirAutomacao(workspaceId: string, id: string): Promise<void> {
  const { error } = await admin()
    .from('automacoes')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)
  if (error) throw error
}

export type FiltroExecucoes = {
  automacaoId?: string
  negocioId?: string
  estado?: EstadoExecucao
  
  desde?: string
  limit?: number
  offset?: number
}


export async function listarExecucoes(workspaceId: string, filtro: FiltroExecucoes = {}): Promise<Execucao[]> {
  const { automacaoId, negocioId, estado, desde, limit = 50, offset = 0 } = filtro

  let q = admin()
    .from('execucoes_automacao')
    .select(COLS_EXECUCOES)
    .eq('workspace_id', workspaceId)
  if (automacaoId) q = q.eq('automacao_id', automacaoId)
  if (negocioId) q = q.eq('negocio_id', negocioId)
  if (estado) q = q.eq('estado', estado)
  if (desde) q = q.gte('criado_em', desde)

  const { data, error } = await q
    .order('criado_em', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data as Execucao[] | null) ?? []
}
