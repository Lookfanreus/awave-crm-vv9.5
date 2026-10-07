


























export const ESPERA_PADRAO_MS = 4 * 60 * 60 * 1000

export const TETO_TOQUES = 1

export const MARGEM_JANELA_MS = 30 * 60 * 1000
const JANELA_MS = 24 * 60 * 60 * 1000

export const ACAO_FOLLOWUP = 'followup'

export type StatusDaConversa = 'aberta' | 'arquivada' | 'assumida' | 'aguardando_humano'

export interface EstadoFollowup {
  status: StatusDaConversa
  
  ultimaMsgInAt: string | null
  
  ultimaMensagemEm: string | null
  proximaAcao: string | null
  proximaAcaoEm: string | null
  toques: number
  
  ligado: boolean
}

export type MotivoCancelamento =
  | 'respondeu'
  | 'assumida'
  | 'arquivada'
  | 'janela_fechada'
  | 'teto'
  | 'devendo_resposta'
  | 'desligado'

export type DecisaoFollowup =
  | { acao: 'nada' }
  | { acao: 'agendar'; em: string; rotulo: string }
  | { acao: 'tocar' }
  | { acao: 'cancelar'; motivo: MotivoCancelamento }

const ms = (iso: string | null): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}


export function decidirFollowup(
  e: EstadoFollowup,
  agoraIso: string,
  cfg: { esperaMs?: number; teto?: number } = {},
): DecisaoFollowup {
  const agora = ms(agoraIso)
  if (agora === null) return { acao: 'nada' }
  const espera = cfg.esperaMs ?? ESPERA_PADRAO_MS
  const teto = cfg.teto ?? TETO_TOQUES
  const temAgendamento = e.proximaAcao === ACAO_FOLLOWUP

  
  if (e.status === 'assumida' || e.status === 'aguardando_humano') {
    return temAgendamento ? { acao: 'cancelar', motivo: 'assumida' } : { acao: 'nada' }
  }
  if (e.status === 'arquivada') {
    return temAgendamento ? { acao: 'cancelar', motivo: 'arquivada' } : { acao: 'nada' }
  }
  if (!e.ligado) return temAgendamento ? { acao: 'cancelar', motivo: 'desligado' } : { acao: 'nada' }

  const entrou = ms(e.ultimaMsgInAt)
  if (entrou === null) return { acao: 'nada' } 

  
  
  
  
  
  
  
  const silencio = agora - entrou
  if (silencio < espera) {
    return temAgendamento ? { acao: 'cancelar', motivo: 'respondeu' } : { acao: 'nada' }
  }

  
  
  
  
  const saiu = ms(e.ultimaMensagemEm)
  if (saiu === null || saiu <= entrou) {
    return temAgendamento ? { acao: 'cancelar', motivo: 'devendo_resposta' } : { acao: 'nada' }
  }

  if (e.toques >= teto) return temAgendamento ? { acao: 'cancelar', motivo: 'teto' } : { acao: 'nada' }
  const agendadoEm = ms(e.proximaAcaoEm)

  
  
  
  
  
  const fecha = entrou + JANELA_MS
  if (agora >= fecha - MARGEM_JANELA_MS) {
    return temAgendamento ? { acao: 'cancelar', motivo: 'janela_fechada' } : { acao: 'nada' }
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (!temAgendamento) {
    const em = entrou + espera
    return { acao: 'agendar', em: new Date(em).toISOString(), rotulo: ACAO_FOLLOWUP }
  }

  
  if (agendadoEm !== null && agora >= agendadoEm) return { acao: 'tocar' }
  return { acao: 'nada' }
}


export function notaFollowup(): string {
  return [
    '[NOTA DO SISTEMA — o cliente NAO enviou esta mensagem. Nao responda a ela, nao a cite.]',
    'A conversa parou e o cliente nao respondeu.',
    'Mande UMA mensagem curta retomando de onde voces pararam: ofereca o proximo passo concreto',
    'ou tire a duvida que ficou no ar. Nao cobre resposta, nao pergunte "ainda esta ai?",',
    'nao peca desculpas por insistir e nao repita o que voce ja disse.',
    'Se nao houver nada de util a acrescentar, responda com uma linha em branco e nada sera enviado.',
  ].join(' ')
}
