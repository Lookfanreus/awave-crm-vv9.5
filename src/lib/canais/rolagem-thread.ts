















export const FOLGA_DO_FIM = 32


export type Medida = {
  
  topo: number
  
  alturaVisivel: number
  
  alturaTotal: number
}


export function estaNoFim(m: Medida, folga: number = FOLGA_DO_FIM): boolean {
  return m.alturaTotal - m.topo - m.alturaVisivel <= folga
}


export function alvoDoFim(m: Medida): number {
  return Math.max(0, m.alturaTotal - m.alturaVisivel)
}


export function alvoAposCrescerNoTopo(p: {
  
  topoAntes: number
  
  alturaAntes: number
  
  alturaDepois: number
}): number {
  return Math.max(0, p.topoAntes + (p.alturaDepois - p.alturaAntes))
}


export type Situacao = {
  
  abriu: boolean
  
  cresceuNoTopo: boolean
  
  estavaNoFim: boolean
}


export type AcaoDeRolagem = 'fim' | 'preservar' | 'nada'


export function acaoDeRolagem(s: Situacao): AcaoDeRolagem {
  if (s.abriu) return 'fim'
  if (s.cresceuNoTopo) return 'preservar'
  return s.estavaNoFim ? 'fim' : 'nada'
}


export type MarcaDoCommit = {
  conversaId: string
  
  acrescimosNoTopo: number
}


export function situacaoDoCommit(
  visto: MarcaDoCommit | null,
  agora: MarcaDoCommit,
  estavaNoFim: boolean,
): Situacao {
  return {
    abriu: visto === null || visto.conversaId !== agora.conversaId,
    cresceuNoTopo: visto !== null && visto.acrescimosNoTopo !== agora.acrescimosNoTopo,
    estavaNoFim,
  }
}


export function rolagemDoCommit(entrada: {
  visto: MarcaDoCommit | null
  agora: MarcaDoCommit
  estavaNoFim: boolean
  
  medida: Medida
  
  alturaAntes: number
}): number | null {
  const acao = acaoDeRolagem(
    situacaoDoCommit(entrada.visto, entrada.agora, entrada.estavaNoFim),
  )
  if (acao === 'fim') return alvoDoFim(entrada.medida)
  if (acao === 'preservar') {
    return alvoAposCrescerNoTopo({
      topoAntes: entrada.medida.topo,
      alturaAntes: entrada.alturaAntes,
      alturaDepois: entrada.medida.alturaTotal,
    })
  }
  return null
}
