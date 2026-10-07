



































export const ESPERA_INICIAL = 3_000


export const ESPERA_MAXIMA = 30_000


export const DURACAO_SAUDAVEL = ESPERA_MAXIMA


export const ESPERA_DO_SINO = 500


export const INTERVALO_RECONCILIACAO = 60_000


export const INTERVALO_MAXIMO = 300_000


export const PULSO = 15_000


export const TETO_DA_TENTATIVA = 30_000


export const FALHAS_PARA_AVISAR = 2


export const LIMIAR_TELA_VELHA = 3 * INTERVALO_RECONCILIACAO


export type DesfechoDaLeitura = 'novidade' | 'sem_novidade' | 'falhou'


export type EstadoDaConexao = {
  
  tentativa: number
  
  assinadoEm: number | null
  
  ultimaTentativa: number
  
  tentativaEmVoo: number | null
  
  ultimaLeituraOk: number
  
  falhasSeguidas: number
  
  folga: number
}


export function conexaoInicial(agora: number): EstadoDaConexao {
  return {
    tentativa: 0,
    assinadoEm: null,
    ultimaTentativa: agora,
    tentativaEmVoo: null,
    ultimaLeituraOk: agora,
    falhasSeguidas: 0,
    folga: 0,
  }
}


export function proximaEspera(tentativa: number): number {
  return Math.min(ESPERA_INICIAL * 2 ** tentativa, ESPERA_MAXIMA)
}


export function intervaloDaSondagem(folga: number): number {
  return Math.min(INTERVALO_RECONCILIACAO * 2 ** folga, INTERVALO_MAXIMO)
}


export type PassoDoStatus = { estado: EstadoDaConexao; reconectarEm: number | null }


const MORTE = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])


export function aoStatusDoCanal(
  estado: EstadoDaConexao,
  status: string,
  agora: number,
): PassoDoStatus {
  if (status === 'SUBSCRIBED') {
    const estadoNovo = estado.assinadoEm === null ? { ...estado, assinadoEm: agora } : estado
    return { estado: estadoNovo, reconectarEm: null }
  }
  if (!MORTE.has(status)) return { estado, reconectarEm: null }

  
  
  
  const durou = estado.assinadoEm === null ? 0 : agora - estado.assinadoEm
  const degrau = durou >= DURACAO_SAUDAVEL ? 0 : estado.tentativa
  return {
    estado: { ...estado, tentativa: degrau + 1, assinadoEm: null },
    reconectarEm: proximaEspera(degrau),
  }
}


export function aoTentarLeitura(estado: EstadoDaConexao, agora: number): EstadoDaConexao {
  return { ...estado, ultimaTentativa: agora, tentativaEmVoo: agora }
}


export function aposLeitura(
  estado: EstadoDaConexao,
  { desfecho, agora }: { desfecho: DesfechoDaLeitura; agora: number },
): EstadoDaConexao {
  if (desfecho === 'falhou') {
    return {
      ...estado,
      tentativaEmVoo: null,
      falhasSeguidas: estado.falhasSeguidas + 1,
      folga: 0,
    }
  }
  return {
    ...estado,
    tentativaEmVoo: null,
    ultimaLeituraOk: agora,
    falhasSeguidas: 0,
    folga: desfecho === 'novidade' ? 0 : estado.folga + 1,
  }
}


export function abandonarSePendurada(estado: EstadoDaConexao, agora: number): EstadoDaConexao {
  if (estado.tentativaEmVoo === null) return estado
  if (agora - estado.tentativaEmVoo < TETO_DA_TENTATIVA) return estado
  return aposLeitura(estado, { desfecho: 'falhou', agora })
}


export function apertarSondagem(estado: EstadoDaConexao): EstadoDaConexao {
  return estado.folga === 0 ? estado : { ...estado, folga: 0 }
}


export function precisaReconciliar(
  estado: EstadoDaConexao,
  { agora, visivel }: { agora: number; visivel: boolean },
): boolean {
  if (!visivel) return false
  return agora - estado.ultimaTentativa >= intervaloDaSondagem(estado.folga)
}


export function avisoDaInbox(estado: EstadoDaConexao, agora: number): string | null {
  if (estado.falhasSeguidas < FALHAS_PARA_AVISAR) return null
  if (agora - estado.ultimaLeituraOk <= LIMIAR_TELA_VELHA) return null
  return AVISO_SEM_CONTATO
}


export const AVISO_SEM_CONTATO =
  'Esta tela não está conseguindo falar com o servidor. Pode haver mensagem nova que você não está vendo — confira sua conexão e atualize a página.'


export type LinhaParaAssinatura = {
  id: string
  ultimaMensagemEm: string | null
  naoLidas: number
  status: string
  atribuidaA: string | null
}

export type MensagemParaAssinatura = { id: string; status: string }


export function assinaturaDaInbox(p: {
  conversas: ReadonlyArray<LinhaParaAssinatura>
  thread: ReadonlyArray<MensagemParaAssinatura> | null
}): string {
  const linhas = p.conversas.map(
    (c) => `${c.id}|${c.ultimaMensagemEm ?? ''}|${c.naoLidas}|${c.status}|${c.atribuidaA ?? ''}`,
  )
  
  
  const thread = p.thread === null ? '-' : p.thread.map((m) => `${m.id}|${m.status}`).join(',')
  return `${linhas.join(',')}#${thread}`
}
