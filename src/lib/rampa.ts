


export const RAMPA_INICIO = '#8B72FF'
export const RAMPA_FIM = '#00C2A8'


function canais(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}


function paraHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}


export function corDaRampa(indice: number, total: number): string {
  if (!Number.isFinite(indice) || !Number.isFinite(total)) return RAMPA_INICIO
  if (total <= 1 || indice <= 0) return RAMPA_INICIO
  if (indice >= total - 1) return RAMPA_FIM

  const t = indice / (total - 1)
  const de = canais(RAMPA_INICIO)
  const ate = canais(RAMPA_FIM)
  return paraHex([0, 1, 2].map((c) => Math.round(de[c] + (ate[c] - de[c]) * t)) as [number, number, number])
}
