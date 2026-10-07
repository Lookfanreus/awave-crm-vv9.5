


export function venceuParado(etapaDesde: string, dias: number, agora: Date): boolean {
  const limite = agora.getTime() - dias * 86_400_000
  return new Date(etapaDesde).getTime() <= limite
}


export function marcaParado(etapaDesde: string): string {
  return `parado:${etapaDesde}`
}


export function venceuAtividade(vencimento: string | null, concluidaEm: string | null, agora: Date): boolean {
  if (!vencimento || concluidaEm) return false
  return new Date(vencimento).getTime() < agora.getTime()
}


export function marcaVencimento(atividadeId: string): string {
  return `venc:${atividadeId}`
}


export function chaveDaMarca(negocioId: string, marca: string): string {
  return `${negocioId}\n${marca}`
}
