



export function legendaAExibir(
  texto: string,
  legenda: string | null | undefined,
): string | null {
  if (!legenda) return null
  
  
  
  return legenda === texto ? null : legenda
}
