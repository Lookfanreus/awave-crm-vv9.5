


















import 'server-only'
import { admin } from '@/server/supabase'


export const TETO_RODADAS_CONVERSA = 12

export const TETO_RODADAS_WORKSPACE = 200

export const TETO_RODADAS_DEPLOY = 500


export const JANELA_RODADAS_MS = 60 * 60_000

export type Rodadas = { conversa: number; workspace: number; deploy: number }
export type Estouro = 'conversa' | 'workspace' | 'deploy' | null


export type Acumulado = {
  conversas: Map<string, number>
  workspaces: Map<string, number>
  deploy: number
}

export function acumuladoVazio(): Acumulado {
  return { conversas: new Map(), workspaces: new Map(), deploy: 0 }
}

export function registrarRodada(a: Acumulado, ws: string, conversaId: string): void {
  a.conversas.set(conversaId, (a.conversas.get(conversaId) ?? 0) + 1)
  a.workspaces.set(ws, (a.workspaces.get(ws) ?? 0) + 1)
  a.deploy += 1
}



export function estourou(
  lidas: Rodadas,
  a: Acumulado,
  ws: string,
  conversaId: string,
  pagasNaLinha = 0,
): Estouro {
  const extra = Math.max(0, pagasNaLinha)
  if (lidas.conversa + (a.conversas.get(conversaId) ?? 0) + extra >= TETO_RODADAS_CONVERSA) return 'conversa'
  if (lidas.workspace + (a.workspaces.get(ws) ?? 0) + extra >= TETO_RODADAS_WORKSPACE) return 'workspace'
  if (lidas.deploy + a.deploy + extra >= TETO_RODADAS_DEPLOY) return 'deploy'
  return null
}


function numero(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error('a contagem de rodadas voltou num formato que nao da para somar')
  }
  return n
}


export async function lerRodadas(ws: string, conversaId: string, agoraMs: number): Promise<Rodadas> {
  const { data, error } = await admin().rpc('rodadas_pagas_na_janela', {
    p_desde: new Date(agoraMs - JANELA_RODADAS_MS).toISOString(),
    p_ws: ws,
    p_conversa: conversaId,
  })
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (error) throw new Error('falha ao contar as rodadas do assistente')
  const linha = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined
  if (!linha) throw new Error('a contagem de rodadas nao voltou')
  return {
    conversa: numero(linha.conversa),
    workspace: numero(linha.workspace),
    deploy: numero(linha.deploy),
  }
}
