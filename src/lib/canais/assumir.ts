


export type StatusDaConversa = 'aberta' | 'arquivada' | 'assumida' | 'aguardando_humano'


type Patch = {
  status: StatusDaConversa
  atribuida_a: string | null
  assumida_em: string | null
  devolvida_em?: string
}


export function decidirAtribuicao(e: {
  statusLido: StatusDaConversa
  membroId: string | null
  
  agoraIso: string
}): { ok: true; patch: Patch; statusEsperado: StatusDaConversa } | { ok: false; motivo: 'arquivada' } {
  
  
  if (!aceitaAtribuicao(e.statusLido)) return { ok: false, motivo: 'arquivada' }

  const patch: Patch = e.membroId
    ? { status: 'assumida', atribuida_a: e.membroId, assumida_em: e.agoraIso }
    : { status: 'aberta', atribuida_a: null, assumida_em: null, devolvida_em: e.agoraIso }

  return { ok: true, patch, statusEsperado: e.statusLido }
}


export function aceitaAtribuicao(status: StatusDaConversa): boolean {
  return status !== 'arquivada'
}


export function podeArquivar(status: StatusDaConversa): boolean {
  return status !== 'arquivada'
}


export function avisoDeArquivada(status: StatusDaConversa): string | null {
  if (status !== 'arquivada') return null
  return 'Esta conversa está arquivada: ela fica fora da lista de ativas e ninguém pode assumi-la. Ela volta para as ativas quando o cliente escrever de novo — ou assim que você responder por aqui.'
}


export type ConversaNaTela = {
  status: StatusDaConversa
  atribuidaA: string | null
  assumidaEm: string | null
}


export function podeDevolver(e: { status: StatusDaConversa; atribuidaA: string | null }): boolean {
  if (e.status === 'aguardando_humano') return true
  if (e.status !== 'assumida' && e.status !== 'aberta') return false
  return e.atribuidaA !== null
}

export type Marcador = {
  
  tipo: 'pessoa' | 'aparelho' | 'espera'
  texto: string
  
  desde: string | null
}


export function marcadorDaConversa(e: ConversaNaTela): Marcador | null {
  if (e.status === 'aguardando_humano') {
    return { tipo: 'espera', texto: 'Esperando uma pessoa', desde: null }
  }
  if (e.status !== 'assumida' && e.status !== 'aberta') return null
  if (e.atribuidaA) return { tipo: 'pessoa', texto: 'Assistente calado', desde: e.assumidaEm }
  
  
  return e.status === 'assumida'
    ? { tipo: 'aparelho', texto: 'Pausado pelo celular', desde: null }
    : null
}
