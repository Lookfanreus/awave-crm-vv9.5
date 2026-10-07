


export function mensagemGate(erro: string, campos: string[] | undefined, generico: string): string {
  if (erro !== 'campos_obrigatorios') return generico
  if (!campos?.length) return 'Preencha os campos obrigatórios da etapa antes de avançar.'
  const lista = campos.join(', ')
  return campos.length === 1
    ? `Preencha “${lista}” antes de avançar deste ponto.`
    : `Preencha estes campos antes de avançar: ${lista}.`
}
