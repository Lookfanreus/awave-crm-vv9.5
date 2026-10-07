


export const MAX_SEGMENTOS = 3


const SEGMENTO = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export function ehSegmentoValido(seg: string): boolean {
  return typeof seg === 'string' && SEGMENTO.test(seg)
}


export function normalizarSlug(segmentos: string[]): string | null {
  if (!Array.isArray(segmentos) || segmentos.length === 0) return null
  if (segmentos.length > MAX_SEGMENTOS) return null
  if (!segmentos.every(ehSegmentoValido)) return null
  return segmentos.join('/')
}


export function ehModuloAusente(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null | undefined
  if (e?.code === 'MODULE_NOT_FOUND' || e?.code === 'ERR_MODULE_NOT_FOUND') return true
  return typeof e?.message === 'string' && /cannot find module|module not found/i.test(e.message)
}
