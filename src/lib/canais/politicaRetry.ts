


export const TETO_TENTATIVAS = 5

const BASE_MS = 30_000
export const TETO_ESPERA_MS = 30 * 60_000


export function proximaTentativa(
  tentativas: number,
  _agoraMs: number,
): { esperaMs: number; desistir: boolean } {
  
  
  
  
  
  if (!Number.isFinite(tentativas) || tentativas >= TETO_TENTATIVAS) {
    return { esperaMs: 0, desistir: true }
  }
  const esperaMs = Math.min(BASE_MS * 2 ** Math.max(0, tentativas), TETO_ESPERA_MS)
  return { esperaMs, desistir: false }
}
