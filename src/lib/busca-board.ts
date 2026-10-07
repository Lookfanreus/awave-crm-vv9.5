

import { normalizar } from '@/lib/texto'




export { normalizar }


export function termosDaBusca(bruto: string): string[] {
  const n = normalizar(bruto)
  return n ? n.split(/\s+/).filter(Boolean) : []
}


export type CartaoBuscavel = {
  titulo: string
  contatoNome: string | null
  empresaNome: string | null
}


export function casa(cartao: CartaoBuscavel, termos: string[]): boolean {
  if (termos.length === 0) return true
  const alvo = normalizar(
    [cartao.titulo, cartao.contatoNome, cartao.empresaNome].filter(Boolean).join(' '),
  )
  return termos.every((t) => alvo.includes(t))
}

type ColunaFiltravel<C> = { cartoes: C[]; total: number; somaValor: number }


export type Recorte = {
  
  busca: string
  
  responsavelId: string | null
}

export type ResultadoBusca<T> = {
  colunas: T[]
  
  encontrados: number
  
  totalGeral: number
  
  filtrando: boolean
  
  porResponsavel: boolean
}


export function filtrarColunas<
  C extends CartaoBuscavel & { valor: string | null; responsavelId: string | null },
  T extends ColunaFiltravel<C>,
>(colunas: T[], recorte: Recorte): ResultadoBusca<T> {
  const termos = termosDaBusca(recorte.busca)
  const porResponsavel = recorte.responsavelId != null
  const filtrando = termos.length > 0 || porResponsavel
  const totalGeral = colunas.reduce((s, c) => s + c.cartoes.length, 0)

  if (!filtrando) {
    return { colunas, encontrados: totalGeral, totalGeral, filtrando: false, porResponsavel: false }
  }

  let encontrados = 0
  const filtradas = colunas.map((col) => {
    const cartoes = col.cartoes.filter(
      (c) =>
        casa(c, termos) &&
        
        
        
        (recorte.responsavelId === null || c.responsavelId === recorte.responsavelId),
    )
    encontrados += cartoes.length
    return {
      ...col,
      cartoes,
      total: cartoes.length,
      somaValor: cartoes.reduce((s, c) => s + Number(c.valor ?? 0), 0),
    }
  })

  return { colunas: filtradas, encontrados, totalGeral, filtrando: true, porResponsavel }
}


export function resumoDoRecorte(
  encontrados: number,
  totalGeral: number,
  porResponsavel = false,
): string {
  if (encontrados === 0) {
    return porResponsavel
      ? `Nenhum negócio seu entre os ${totalGeral} do funil`
      : `Nenhum negócio encontrado entre os ${totalGeral} do funil`
  }
  const plural = `${encontrados} de ${totalGeral} ${totalGeral === 1 ? 'negócio' : 'negócios'}`
  return porResponsavel ? `${plural} · só os seus` : plural
}


export function vazioDaColuna(
  filtrando: boolean,
  porResponsavel: boolean,
  temBusca: boolean,
): { titulo: string; texto: string } {
  if (!filtrando) {
    return { titulo: 'Etapa vazia', texto: 'Arraste um negócio para cá ou crie um abaixo.' }
  }
  if (porResponsavel && !temBusca) {
    return { titulo: 'Nada seu nesta etapa', texto: 'Nenhum negócio desta etapa está com você.' }
  }
  if (porResponsavel) {
    return {
      titulo: 'Nada seu nesta etapa',
      texto: 'Nenhum negócio seu desta etapa casa com a busca.',
    }
  }
  return { titulo: 'Nada nesta etapa', texto: 'Nenhum negócio desta etapa casa com a busca.' }
}

