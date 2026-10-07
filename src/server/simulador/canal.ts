





import 'server-only'
import { admin } from '@/server/supabase'
import { garantirConversa } from '@/server/canais/dispatch'
import type { CanalRow } from '@/server/canais/registry'
import type { CanalEvent } from '@/server/canais/types'
import {
  NOME_DO_CANAL_DE_SIMULACAO,
  PROVIDER_DE_SIMULACAO,
} from '@/lib/canais/simulacao'


const COLUNAS_DO_CANAL = 'id, workspace_id, provider, external_id, config, agente_ligado'

type ConfigDoCanal = { sessao?: string; server_url?: string }

export type CanalDeSimulacao = CanalRow & { config: ConfigDoCanal }


function novaSessao(): string {
  return `sim:${crypto.randomUUID()}`
}

function comoConfig(bruto: unknown): ConfigDoCanal {
  return bruto && typeof bruto === 'object' ? (bruto as ConfigDoCanal) : {}
}

function comoCanal(bruto: unknown): CanalDeSimulacao | null {
  if (!bruto || typeof bruto !== 'object') return null
  const l = bruto as Record<string, unknown>
  if (typeof l.id !== 'string' || typeof l.workspace_id !== 'string') return null
  return {
    id: l.id,
    workspace_id: l.workspace_id,
    provider: typeof l.provider === 'string' ? l.provider : '',
    external_id: typeof l.external_id === 'string' ? l.external_id : null,
    config: comoConfig(l.config),
    
    
    agente_ligado: l.agente_ligado === true,
  }
}


export async function lerCanalDeSimulacao(ws: string): Promise<CanalDeSimulacao | null> {
  const { data, error } = await admin()
    .from('canais')
    .select(COLUNAS_DO_CANAL)
    .eq('workspace_id', ws)
    .eq('provider', PROVIDER_DE_SIMULACAO)
    
    
    
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()
  
  
  
  
  
  
  
  
  
  if (error) throw new Error('falha ao ler o canal de simulacao')
  return comoCanal(data)
}


export async function garantirCanalDeSimulacao(ws: string): Promise<CanalDeSimulacao> {
  const existente = await lerCanalDeSimulacao(ws)
  if (existente) return existente

  const { data, error } = await admin()
    .from('canais')
    .insert({
      workspace_id: ws,
      provider: PROVIDER_DE_SIMULACAO,
      nome: NOME_DO_CANAL_DE_SIMULACAO,
      agente_ligado: true,
      config: { sessao: novaSessao() },
    })
    .select(COLUNAS_DO_CANAL)
    .single()
  const criado = comoCanal(data)
  if (error || !criado) throw new Error('falha ao criar o canal de simulacao')
  return criado
}


async function sessaoAtual(canal: CanalDeSimulacao): Promise<string> {
  const atual = canal.config.sessao
  if (typeof atual === 'string' && atual.length > 0) return atual
  const nova = novaSessao()
  await gravarSessao(canal, nova)
  return nova
}

async function gravarSessao(canal: CanalDeSimulacao, sessao: string): Promise<void> {
  
  
  const { error } = await admin()
    .from('canais')
    .update({ config: { ...canal.config, sessao }, atualizado_em: new Date().toISOString() })
    .eq('workspace_id', canal.workspace_id)
    .eq('id', canal.id)
  if (error) throw new Error('falha ao abrir a sessao de simulacao')
}


export async function conversaDeSimulacao(
  ws: string,
  canal: CanalDeSimulacao,
): Promise<{ id: string; chaveExterna: string }> {
  const chaveExterna = await sessaoAtual(canal)
  return { id: await garantirConversa(ws, canal.id, chaveExterna, null), chaveExterna }
}


export async function conversaDaSessaoDeSimulacao(
  ws: string,
  canal: CanalDeSimulacao,
): Promise<string | null> {
  const sessao = canal.config.sessao
  if (typeof sessao !== 'string' || sessao.length === 0) return null
  const { data, error } = await admin()
    .from('conversas')
    .select('id')
    .eq('workspace_id', ws)
    .eq('canal_id', canal.id)
    .eq('chave_externa', sessao)
    .maybeSingle()
  if (error) throw new Error('falha ao ler a conversa de simulacao')
  return (data as { id: string } | null)?.id ?? null
}


export async function recomecarSimulacao(ws: string, canal: CanalDeSimulacao): Promise<void> {
  const chaveAtual = canal.config.sessao
  if (typeof chaveAtual === 'string' && chaveAtual.length > 0) {
    
    
    
    const { error } = await admin()
      .from('conversas')
      .update({ status: 'arquivada', atualizado_em: new Date().toISOString() })
      .eq('workspace_id', ws)
      .eq('canal_id', canal.id)
      .eq('chave_externa', chaveAtual)
    if (error) throw new Error('falha ao limpar a simulacao')
  }
  await gravarSessao(canal, novaSessao())
}


export async function ehConversaDeSimulacao(ws: string, conversaId: string): Promise<boolean> {
  const { data, error } = await admin()
    .from('conversas')
    .select('id, canais!inner(provider)')
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .maybeSingle()
  if (error || !data) return false
  return providerDoEmbed((data as { canais?: unknown }).canais) === PROVIDER_DE_SIMULACAO
}


export function providerDoEmbed(x: unknown): string | null {
  if (!x) return null
  const o = Array.isArray(x) ? x[0] : x
  const p = (o as { provider?: unknown } | undefined)?.provider
  return typeof p === 'string' ? p : null
}


export async function statusDaConversaDeSimulacao(
  ws: string,
  conversaId: string,
): Promise<string | null> {
  const { data, error } = await admin()
    .from('conversas')
    .select('status')
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .maybeSingle()
  if (error || !data) return null
  const s = (data as { status?: unknown }).status
  return typeof s === 'string' ? s : null
}


const PREFIXO_DE_ENTRADA = 'sim-in:'


export function eventoDeSimulacao(
  chaveExterna: string,
  texto: string,
  agoraMs: number = Date.now(),
): CanalEvent {
  return {
    tipo: 'mensagem',
    externalId: `${PREFIXO_DE_ENTRADA}${crypto.randomUUID()}`,
    conversaExterna: chaveExterna,
    tipoChat: 'individual',
    remetente: null,
    
    
    
    
    
    identidadeExterna: null,
    nomeRemetente: null,
    timestamp: new Date(agoraMs).toISOString(),
    texto,
    midia: null,
    
    
    origem: 'contato',
  }
}
