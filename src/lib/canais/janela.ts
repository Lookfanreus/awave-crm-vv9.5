







export type StatusMensagem =
  | 'recebida'  
  | 'pendente'  
  | 'enviada'
  | 'entregue'
  | 'lida'
  | 'falhou'

export type StatusEntregaProvider = 'sent' | 'delivered' | 'read' | 'failed'


const ORDEM: Partial<Record<StatusMensagem, number>> = { enviada: 1, entregue: 2, lida: 3 }


export function aplicarStatusEntrega(
  atual: StatusMensagem,
  evento: StatusEntregaProvider,
): StatusMensagem {
  const posicao = ORDEM[atual]
  if (posicao === undefined) return atual 
  if (evento === 'failed') return atual === 'enviada' ? 'falhou' : atual
  const alvo: StatusMensagem =
    evento === 'read' ? 'lida' : evento === 'delivered' ? 'entregue' : 'enviada'
  return (ORDEM[alvo] ?? 0) > posicao ? alvo : atual
}
