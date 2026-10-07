


export type EstadoDoCadastro = {
  
  bootstrapFeito: string | null
  
  signupAberto: string | null
}


export function mostrarLinkDeCadastro(estado: EstadoDoCadastro | null): boolean {
  if (!estado) return true
  
  
  if (estado.bootstrapFeito !== 'true') return true
  return estado.signupAberto === 'true'
}
