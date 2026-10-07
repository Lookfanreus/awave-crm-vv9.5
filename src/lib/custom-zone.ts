

export const ZONA = 'custom'


export function ehCaminhoCustom(caminho: string): boolean {
  const p = String(caminho).replace(/^\/+/, '')
  return p === ZONA || p.startsWith(ZONA + '/')
}


export const INICIO_FAIXA_CUSTOM = '9000'

export function ehVersaoDoComprador(versao: string): boolean {
  
  return versao >= INICIO_FAIXA_CUSTOM
}


export const PRESERVADOS_NA_RAIZ = new Set([ZONA, '.git'])

export function podeApagarNaRaiz(nomeNoTopo: string): boolean {
  return !PRESERVADOS_NA_RAIZ.has(nomeNoTopo)
}


export function planejarPublicacao(entradas: {
  noClone: string[]
  noExtraido: string[]
}): {
  apagar: string[]
  copiar: string[]
  semeouCustom: boolean
  semearDentroDoCustom: boolean
} {
  const cloneTemCustom = entradas.noClone.includes(ZONA)
  const extraidoTemCustom = entradas.noExtraido.includes(ZONA)

  const apagar = entradas.noClone.filter(podeApagarNaRaiz)

  
  
  const copiar = entradas.noExtraido.filter((e) => !(e === ZONA && cloneTemCustom))

  return {
    apagar,
    copiar,
    semeouCustom: extraidoTemCustom && !cloneTemCustom,
    semearDentroDoCustom: extraidoTemCustom && cloneTemCustom,
  }
}
