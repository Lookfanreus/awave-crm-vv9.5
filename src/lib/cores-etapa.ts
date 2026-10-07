


export const PALETA_ETAPAS: readonly string[] = [
  '#94a3b8', '#60a5fa', '#a78bfa', '#fbbf24', '#34d399',
  '#f472b6', '#38bdf8', '#f59e0b',
] as const


export function corValida(cor: string): boolean {
  return PALETA_ETAPAS.includes(cor)
}


export const NOME_DA_COR: Readonly<Record<string, string>> = {
  '#94a3b8': 'Cinza',
  '#60a5fa': 'Azul',
  '#a78bfa': 'Roxo',
  '#fbbf24': 'Âmbar',
  '#34d399': 'Verde',
  '#f472b6': 'Rosa',
  '#38bdf8': 'Ciano',
  '#f59e0b': 'Laranja',
}


export function nomeDaCor(cor: string): string {
  return NOME_DA_COR[cor] ?? cor
}


export function proximaCor(usadas: string[]): string {
  const livre = PALETA_ETAPAS.find((c) => !usadas.includes(c))
  return livre ?? PALETA_ETAPAS[usadas.length % PALETA_ETAPAS.length]
}
