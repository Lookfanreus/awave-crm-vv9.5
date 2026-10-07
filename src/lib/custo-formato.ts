





const NAO_SEI = '—'


export function formatarUsd(usd: number | null, parcial: boolean): string {
  if (usd === null || !Number.isFinite(usd)) return NAO_SEI
  const casas = usd >= 0.01 || usd <= 0 ? 2 : usd >= 0.0001 ? 4 : 6
  const valor = usd.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
  return `${parcial ? 'cerca de ' : ''}US$ ${valor}`
}


export function formatarTokens(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return NAO_SEI
  return n.toLocaleString('pt-BR')
}


export function avisoDoCusto(r: {
  usd: number | null
  parcial: boolean
  
  parcialPorModelo: boolean
  parcialPorContagem: boolean
  
  modeloSemPreco: boolean
}): string {
  if (r.usd === null) {
    
    
    
    
    
    
    return 'Não consegui ler o gasto deste mês agora — o número acima está em branco por isso, e não porque nada foi gasto. Recarregar a página resolve se foi um soluço; se o branco continuar, insistir não adianta e o gasto está na fatura da sua conta de inteligência artificial.'
  }
  if (r.modeloSemPreco) {
    
    
    
    return 'Não conheço o preço do modelo escolhido, então as respostas dele ficaram de fora da soma acima. Quem manda é a fatura da sua conta de inteligência artificial.'
  }
  if (r.parcialPorModelo && r.parcialPorContagem) {
    return 'Algumas respostas ficaram de fora da soma acima: parte usou um modelo que não está na nossa tabela de preços, e em parte a conta de inteligência artificial não informou o quanto foi usado.'
  }
  if (r.parcialPorModelo) {
    return 'Algumas respostas usaram um modelo que não está na nossa tabela de preços, então elas ficaram de fora da soma acima.'
  }
  if (r.parcialPorContagem) {
    
    
    
    
    return 'Em algumas respostas a conta de inteligência artificial não informou o quanto foi usado — é o que acontece quando a resposta é interrompida no meio —, então elas ficaram de fora da soma acima.'
  }
  if (r.parcial) {
    
    
    return 'Algumas respostas ficaram de fora da soma acima.'
  }
  return ''
}
