


export const PISO_PCT = 2


export function comprimentoBarra(valor: number, maximo: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(maximo)) return 0
  if (maximo <= 0 || valor <= 0) return 0
  const bruto = (valor / maximo) * 100
  return Math.min(100, Math.max(PISO_PCT, Math.round(bruto)))
}
