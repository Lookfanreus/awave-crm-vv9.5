
export function chaveDaPersona(
  
  agenteId: string,
  persona: {
    nomeInterno: string
    nome: string
    tratamento: 'voce' | 'senhor'
    sobreONegocio: string
  },
): string {
  return JSON.stringify([
    agenteId,
    persona.nomeInterno,
    persona.nome,
    persona.tratamento,
    persona.sobreONegocio,
  ])
}
