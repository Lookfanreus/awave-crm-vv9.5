


export type Ponto = [number, number]


export type SinalDaSerie =
  
  | 'sem-dado'
  
  | 'sem-variacao'
  
  | 'movimento'


export function sinalDaSerie(serie: (number | null)[] | null): SinalDaSerie {
  const definidos = (serie ?? []).filter((v): v is number => v != null)
  if (definidos.length === 0) return 'sem-dado'
  const maior = Math.max(...definidos)
  const menor = Math.min(...definidos)
  if (maior !== menor) return 'movimento'
  return maior === 0 ? 'sem-dado' : 'sem-variacao'
}


export function pontosDaSerie(
  serie: (number | null)[],
  largura: number,
  altura: number,
): (Ponto | null)[] {
  if (serie.length === 0) return []

  
  
  
  const definidos = serie.filter((v): v is number => v != null)
  if (definidos.length === 0) return serie.map(() => null)

  const maior = Math.max(...definidos)
  const menor = Math.min(...definidos)
  const amplitude = maior - menor
  const ultimo = serie.length - 1

  return serie.map((valor, i): Ponto | null => {
    if (valor == null) return null
    const x = ultimo === 0 ? largura / 2 : (i / ultimo) * largura
    const y = amplitude === 0 ? altura / 2 : altura - ((valor - menor) / amplitude) * altura
    return [x, y]
  })
}


function arredonda(n: number): number {
  return Math.round(n * 100) / 100
}


export function segmentos(pontos: (Ponto | null)[]): Ponto[][] {
  const saida: Ponto[][] = []
  let atual: Ponto[] = []
  for (const p of pontos) {
    if (p == null) {
      if (atual.length > 0) saida.push(atual)
      atual = []
    } else {
      atual.push(p)
    }
  }
  if (atual.length > 0) saida.push(atual)
  return saida
}


export function caminho(pontos: (Ponto | null)[]): string {
  return segmentos(pontos)
    .map((seg) =>
      seg.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${arredonda(x)} ${arredonda(y)}`).join(' '),
    )
    .join(' ')
}


export function caminhoArea(pontos: (Ponto | null)[], base: number): string {
  return segmentos(pontos)
    .filter((seg) => seg.length > 1)
    .map((seg) => {
      const traco = seg
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${arredonda(x)} ${arredonda(y)}`)
        .join(' ')
      const xFim = arredonda(seg[seg.length - 1][0])
      const xIni = arredonda(seg[0][0])
      return `${traco} L${xFim} ${arredonda(base)} L${xIni} ${arredonda(base)} Z`
    })
    .join(' ')
}


export function ultimoPonto(pontos: (Ponto | null)[]): Ponto | null {
  return pontos.length === 0 ? null : (pontos[pontos.length - 1] ?? null)
}


export function pontoEmPorcento(
  [x, y]: Ponto,
  largura: number,
  altura: number,
): { x: number; y: number } {
  return {
    x: largura === 0 ? 0 : arredonda((x / largura) * 100),
    y: altura === 0 ? 0 : arredonda((y / altura) * 100),
  }
}
