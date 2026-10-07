

const DIA_MS = 24 * 60 * 60 * 1000


export function diasAtePrevisao(previsao: string, agora: Date = new Date()): number {
  const hoje = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
  return Math.round((new Date(`${previsao}T00:00:00.000Z`).getTime() - hoje) / DIA_MS)
}


export function variantePrevisao(diasAte: number): 'erro' | 'accent' | 'neutro' {
  if (diasAte < 0) return 'erro'
  return diasAte <= 2 ? 'accent' : 'neutro'
}


const HORIZONTE_UTIL = 7


export function mostrarPrevisaoNoCartao(diasAte: number): boolean {
  return diasAte < 0 || diasAte <= HORIZONTE_UTIL
}


export function rotuloPrevisao(diasAte: number): string {
  if (diasAte < 0) return `venceu há ${Math.abs(diasAte)}d`
  if (diasAte === 0) return 'hoje'
  return `em ${diasAte}d`
}


export function rotuloPrevisaoCartao(diasAte: number): string {
  if (diasAte < 0) return `venceu há ${Math.abs(diasAte)}d`
  if (diasAte === 0) return 'fecha hoje'
  return `fecha em ${diasAte}d`
}


export function dataPrevisaoBR(previsao: string): string {
  const [ano, mes, dia] = previsao.split('-')
  if (!ano || !mes || !dia) return previsao
  return `${dia}/${mes}/${ano}`
}


export function frasePrevisao(diasAte: number): string {
  if (diasAte < 0) return `venceu há ${plural(Math.abs(diasAte))}`
  if (diasAte === 0) return 'fecha hoje'
  return `fecha em ${plural(diasAte)}`
}


export function fraseParado(diasParado: number): string {
  return diasParado === 0 ? 'parado desde hoje' : `parado há ${plural(diasParado)}`
}

function plural(dias: number): string {
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
}
