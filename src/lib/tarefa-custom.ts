import { criarOrcamento, LIMITE_DO_TICK_MS } from '@/lib/orcamento-tick'
import { ehSegmentoValido } from '@/lib/zona-custom'




export const PADRAO_MS = 60 * 60_000


export const PISO_MS = 60_000


export const TETO_POR_TAREFA_MS = 10_000


export const ORCAMENTO_MAX_MS = 20_000


export { LIMITE_DO_TICK_MS }

const UNIDADES: Record<string, number> = { s: 1_000, m: 60_000, h: 60 * 60_000, d: 24 * 60 * 60_000 }


export function intervaloEmMs(cada: unknown): number {
  if (typeof cada !== 'string') return PADRAO_MS
  const m = /^\s*(\d+)\s*([smhd])\s*$/i.exec(cada)
  if (!m) return PADRAO_MS
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return PADRAO_MS
  const ms = n * UNIDADES[m[2].toLowerCase()]
  return ms < PISO_MS ? PISO_MS : ms
}


export function arquivoDoEvento(tipo: unknown): string | null {
  if (typeof tipo !== 'string') return null
  const nome = tipo.trim().replace(/_/g, '-')
  return ehSegmentoValido(nome) ? nome : null
}


export function deveRodar(ultimoEmMs: number | null, intervaloMs: number, agoraMs: number): boolean {
  if (ultimoEmMs === null || !Number.isFinite(ultimoEmMs)) return true
  if (ultimoEmMs > agoraMs) return true
  return agoraMs - ultimoEmMs >= intervaloMs
}


export function orcamentoRestante(comecoDoTickMs: number, agoraMs: number): number {
  
  
  
  
  return criarOrcamento(comecoDoTickMs, () => agoraMs).fatiaPara('custom', ORCAMENTO_MAX_MS)
}
