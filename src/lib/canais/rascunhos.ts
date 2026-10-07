




















export type Rascunhos = Readonly<Record<string, string>>


export function rascunhoDe(rascunhos: Rascunhos, conversaId: string): string {
  return Object.hasOwn(rascunhos, conversaId) ? rascunhos[conversaId] : ''
}


export function comRascunho(
  rascunhos: Rascunhos,
  conversaId: string,
  texto: string,
): Rascunhos {
  if (texto === '') {
    
    
    if (!Object.hasOwn(rascunhos, conversaId)) return rascunhos
    const saida: Record<string, string> = {}
    for (const [id, valor] of Object.entries(rascunhos)) {
      if (id !== conversaId) saida[id] = valor
    }
    return saida
  }
  if (rascunhos[conversaId] === texto) return rascunhos
  return { ...rascunhos, [conversaId]: texto }
}
