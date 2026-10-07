








export const TETO_DESCARTES = 2

export interface PreSendEstado {
  
  snapshotInAt: string | null
  
  atualInAt: string | null
  
  descartesSeguidos: number
}

export type PreSendDecisao =
  | { acao: 'enviar'; motivo: 'sem_inbound_novo' | 'teto_de_descarte' }
  | { acao: 'descartar'; motivo: 'inbound_novo' }


function ms(iso: string | null): number | null {
  if (!iso) return null
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : null
}

export function decidirPreSend(e: PreSendEstado, tetoDescartes = TETO_DESCARTES): PreSendDecisao {
  const atual = ms(e.atualInAt)
  const snap = ms(e.snapshotInAt)

  const novo = atual !== null && (snap === null || atual > snap)
  if (!novo) return { acao: 'enviar', motivo: 'sem_inbound_novo' }

  
  
  if (e.descartesSeguidos >= tetoDescartes) return { acao: 'enviar', motivo: 'teto_de_descarte' }
  return { acao: 'descartar', motivo: 'inbound_novo' }
}
