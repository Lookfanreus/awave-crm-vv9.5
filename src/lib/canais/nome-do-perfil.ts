




























export type SituacaoDoNome = 'nao_se_aplica' | 'buscando' | 'resolvido' | 'sem_nome'


export type LinhaDeNome = {
  
  perfilPendente: boolean | null
  
  nome: string | null
  
  identidadeExterna: string | null
}


export function situacaoDoNome(linha: LinhaDeNome): SituacaoDoNome {
  if (linha.perfilPendente === null || linha.perfilPendente === undefined) return 'nao_se_aplica'
  if (linha.perfilPendente) return 'buscando'
  const identidade = (linha.identidadeExterna ?? '').trim()
  if (!identidade) return 'resolvido'
  return (linha.nome ?? '').trim() === identidade ? 'sem_nome' : 'resolvido'
}


export function copyDoNome(situacao: SituacaoDoNome): string | null {
  switch (situacao) {
    case 'buscando':
      
      
      return 'Ainda não sabemos o nome desta pessoa — estamos perguntando ao Instagram.'
    case 'sem_nome':
      return 'O Instagram não liberou o nome desta pessoa. O número acima é como ela é identificada lá.'
    default:
      return null
  }
}
