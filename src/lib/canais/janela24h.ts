














export const CODIGO_FORA_DA_JANELA = '131047'


export const CODIGO_IG_FORA_DA_JANELA = '2534022'


export type RedeDaJanela = {
  
  nome: string
  
  codigoForaDaJanela: string
}


const REDES: Record<string, RedeDaJanela> = Object.assign(Object.create(null), {
  whatsapp_cloud: { nome: 'WhatsApp', codigoForaDaJanela: CODIGO_FORA_DA_JANELA },
  instagram: { nome: 'Instagram', codigoForaDaJanela: CODIGO_IG_FORA_DA_JANELA },
})


export function redeDaJanela(provider: string): RedeDaJanela | null {
  if (typeof provider !== 'string') return null
  return Object.hasOwn(REDES, provider) ? REDES[provider] : null
}


export function nomeDaRede(provider: string): string {
  return redeDaJanela(provider)?.nome ?? 'provedor deste canal'
}

export type EstadoJanela = 'nao_se_aplica' | 'aberta' | 'fechada' | 'desconhecida'


export const ESTADOS = ['nao_se_aplica', 'aberta', 'fechada', 'desconhecida'] as const

export const JANELA_MS = 24 * 60 * 60 * 1000






const PISO_MS = Date.UTC(2000, 0, 1)

export type LeituraDaJanela = {
  estado: EstadoJanela
  
  restanteMs: number | null
}


export function estadoDaJanela(entrada: {
  temJanela: boolean
  ultimaEntradaIso: string | null
  agoraMs: number
}): LeituraDaJanela {
  if (entrada.temJanela !== true) return { estado: 'nao_se_aplica', restanteMs: null }

  const bruto = entrada.ultimaEntradaIso
  if (typeof bruto !== 'string' || bruto.length === 0) return { estado: 'desconhecida', restanteMs: null }

  const ms = Date.parse(bruto)
  if (!Number.isFinite(ms)) return { estado: 'desconhecida', restanteMs: null }
  if (ms < PISO_MS) return { estado: 'desconhecida', restanteMs: null }

  const agora = entrada.agoraMs
  if (!Number.isFinite(agora)) return { estado: 'desconhecida', restanteMs: null }
  
  
  
  if (ms > agora) return { estado: 'desconhecida', restanteMs: null }

  const decorrido = agora - ms
  
  if (decorrido >= JANELA_MS) return { estado: 'fechada', restanteMs: null }
  return { estado: 'aberta', restanteMs: JANELA_MS - decorrido }
}


const TEXTOS: Record<EstadoJanela, (rede: string) => string> = {
  nao_se_aplica: () =>
    'Este canal não tem prazo de resposta — o que vale é a regra do provedor dele.',
  aberta: (rede) =>
    `O ${rede} aceita resposta livre por 24 horas depois da última mensagem desta pessoa. ` +
    `Este relógio é a nossa cópia; quem decide na hora do envio é o ${rede}.`,
  fechada: (rede) =>
    `Faz mais de 24 horas desde a última mensagem desta pessoa. O ${rede} só aceita resposta ` +
    'livre dentro desse prazo — depois dele, é preciso um modelo aprovado, que esta versão ' +
    `ainda não envia. Você pode tentar mesmo assim; se o ${rede} recusar, a mensagem aparece ` +
    'como falhou.',
  desconhecida: (rede) =>
    'Não sabemos há quanto tempo esta pessoa escreveu. Responda normalmente — quem confere o ' +
    `prazo é o ${rede}.`,
}


export function textoDaJanela(estado: EstadoJanela, rede: string): string {
  const monta = Object.hasOwn(TEXTOS, estado) ? TEXTOS[estado] : TEXTOS.desconhecida
  return monta(typeof rede === 'string' && rede.trim() ? rede.trim() : 'provedor deste canal')
}


export function textoErroForaDaJanela(rede: string): string {
  const nome = typeof rede === 'string' && rede.trim() ? rede.trim() : 'provedor deste canal'
  return (
    `o ${nome} recusou: faz mais de 24 horas desde a última mensagem desta pessoa, e fora ` +
    'desse prazo só passa modelo aprovado'
  )
}
