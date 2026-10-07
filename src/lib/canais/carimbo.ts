













export const MS_MIN_CARIMBO = Date.UTC(2000, 0, 1)


const FOLGA_MS = 24 * 60 * 60 * 1000


const MS_MAX_DATE = 8.64e15


function ehInstanteValido(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= MS_MAX_DATE
}


export function isoDeCarimbo(ms: number | undefined, agoraMs: number): string {
  const base = ehInstanteValido(agoraMs) ? agoraMs : Date.now()
  const teto = base + FOLGA_MS
  return ehInstanteValido(ms) && ms >= MS_MIN_CARIMBO && ms <= teto
    ? new Date(ms).toISOString()
    : new Date(base).toISOString()
}
