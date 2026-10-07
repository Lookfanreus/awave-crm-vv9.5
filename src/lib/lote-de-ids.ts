



















export const TETO_PRATICO_DA_URL = 8_192


export const URL_MAXIMA_POR_LOTE = TETO_PRATICO_DA_URL / 2


export const LOTE_DE_IDS = 90


export function emLotes<T>(itens: readonly T[], tamanho: number = LOTE_DE_IDS): T[][] {
  if (tamanho < 1) throw new RangeError('emLotes: tamanho tem de ser >= 1')
  const saida: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) saida.push(itens.slice(i, i + tamanho))
  return saida
}
