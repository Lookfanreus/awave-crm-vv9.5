


export const TENTATIVAS = 3


const ESPERA_MS = [0, 1_500, 4_000]


export const TETO_ESPERA_MS = 10_000


export function deveRetentar(status: number | null, retryAfter: string | null = null): boolean {
  if (status === null) return true
  if (status === 408) return true
  if (status === 429) return (retryAfter ?? '').trim() !== ''
  
  
  return status >= 500 && status !== 503
}


export function esperaMs(tentativa: number, retryAfter: string | null, agoraMs: number): number | null {
  const pedido = segundosDoRetryAfter(retryAfter, agoraMs)
  if (pedido !== null) return pedido > TETO_ESPERA_MS ? null : pedido
  return ESPERA_MS[tentativa] ?? null
}


function segundosDoRetryAfter(valor: string | null, agoraMs: number): number | null {
  if (!valor) return null
  const cru = valor.trim()
  if (/^\d+$/.test(cru)) return Number(cru) * 1000
  const data = Date.parse(cru)
  if (Number.isNaN(data)) return null
  return Math.max(0, data - agoraMs)
}
