











import type { CorteDoEnvelope } from '@/server/canais/types'


export function contarCorte(
  corte: CorteDoEnvelope | undefined,
  total: number,
  lidos: number,
): void {
  if (corte && total > lidos) corte.descartados += total - lidos
}


export function comoTexto(x: unknown): string | undefined {
  return typeof x === 'string' ? semRecusadosPeloBanco(x) : undefined
}


export function comoId(x: unknown): string | undefined {
  if (typeof x === 'string') return semRecusadosPeloBanco(x)
  if (typeof x === 'number') return Number.isFinite(x) ? String(x) : undefined
  if (typeof x === 'bigint') return String(x)
  return undefined
}


const RECUSADOS_PELO_BANCO =
  /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

export function semRecusadosPeloBanco(bruto: string): string {
  return bruto.replace(RECUSADOS_PELO_BANCO, '')
}


export const LIMITE_TEXTO = 8_000

export const LIMITE_NOME = 200


export function limparTexto(bruto: unknown, limite: number): string {
  
  
  
  if (typeof bruto !== 'string' || bruto.length === 0) return ''
  
  
  
  
  
  
  
  const limpo = bruto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u202A-\u202E\u2066-\u2069]/g, '')
  
  
  
  
  
  
  
  
  
  
  
  return semRecusadosPeloBanco(limpo.slice(0, limite))
}
