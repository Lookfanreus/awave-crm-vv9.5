


export type MetricasRolagem = {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}


export type EstadoRolagem = {
  esquerda: boolean
  direita: boolean
}


const FOLGA = 2


export function estadoRolagem(m: MetricasRolagem): EstadoRolagem {
  const { scrollLeft, scrollWidth, clientWidth } = m
  if (!Number.isFinite(scrollLeft) || !Number.isFinite(scrollWidth) || !Number.isFinite(clientWidth)) {
    return { esquerda: false, direita: false }
  }
  const maximo = Math.max(0, scrollWidth - clientWidth)
  const atual = Math.min(Math.max(scrollLeft, 0), maximo)
  return {
    esquerda: atual > FOLGA,
    direita: maximo - atual > FOLGA,
  }
}


export function destinoDoPasso(m: MetricasRolagem, direcao: 1 | -1, passo: number): number {
  const { scrollLeft, scrollWidth, clientWidth } = m
  if (!Number.isFinite(scrollLeft) || !Number.isFinite(scrollWidth) || !Number.isFinite(clientWidth)) {
    return 0
  }
  const maximo = Math.max(0, scrollWidth - clientWidth)
  const atual = Math.min(Math.max(scrollLeft, 0), maximo)
  const avanco = Number.isFinite(passo) && passo > 0 ? passo : Math.max(1, clientWidth * 0.8)
  return Math.min(Math.max(atual + direcao * avanco, 0), maximo)
}
