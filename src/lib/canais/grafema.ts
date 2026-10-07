






































const SEGMENTADOR: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null


function partiuOPar(texto: string, corte: number): boolean {
  const anterior = texto.charCodeAt(corte - 1)
  const seguinte = texto.charCodeAt(corte)
  return anterior >= 0xd800 && anterior <= 0xdbff && seguinte >= 0xdc00 && seguinte <= 0xdfff
}


export function recuarParaFronteira(texto: string, corte: number): number {
  if (corte <= 1) return corte
  const recuado = fronteiraEm(texto, corte)
  
  return recuado >= 1 ? recuado : corte
}


const MARGEM_DE_CLUSTER = 64


function fronteiraEm(texto: string, corte: number): number {
  if (corte <= 0) return corte
  if (corte >= texto.length) return corte

  if (!SEGMENTADOR) return partiuOPar(texto, corte) ? corte - 1 : corte

  
  
  const fim = corte + MARGEM_DE_CLUSTER
  const janela = fim >= texto.length ? texto : texto.slice(0, fim)
  
  
  const dentro = SEGMENTADOR.segment(janela).containing(corte)
  return dentro ? dentro.index : corte
}


export function cortarNoTeto(texto: string, teto: number): string {
  if (teto <= 0) return ''
  if (texto.length <= teto) return texto
  return texto.slice(0, fronteiraEm(texto, teto))
}
