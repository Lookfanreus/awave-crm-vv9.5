


function preenchido(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}


export function camposFaltantes(obrigatorios: string[], campos: Record<string, unknown>): string[] {
  return obrigatorios.filter((slug) => !preenchido(campos[slug]))
}


export function avancou(ordemOrigem: number, ordemDestino: number): boolean {
  return ordemDestino > ordemOrigem
}
