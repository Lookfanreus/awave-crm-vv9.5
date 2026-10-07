




import { causaDaFalhaSemResposta } from '@/lib/canais/erroMeta'
import { normalizarTelefone } from '@/lib/canais/telefone'
import { redigirValores } from '@/lib/canais/redigir'
import { isoDeCarimbo } from '@/lib/canais/carimbo'


import { nomeDaInstancia } from '@/lib/canais/identidade-do-envelope'





import {
  comoId,
  comoTexto,
  contarCorte,
  limparTexto,
  LIMITE_NOME,
  LIMITE_TEXTO,
} from '@/server/canais/providers/fronteira'
import type {
  CanalAdapter,
  CanalCreds,
  CanalEvent,
  EnvioResultado,
  HttpDeps,
  CorteDoEnvelope,
  InboundMidia,
  RefExternaMidia,
  TipoChat,
} from '@/server/canais/types'
import { refNaoValidada, segredosDe } from '@/server/canais/types'
import type { StatusEntregaProvider } from '@/lib/canais/janela'


const TIMEOUT_ENVIO_MS = 20_000


export const TIMEOUT_RESOLVER_MIDIA_MS = 10_000


interface UazapiMidia { URL?: string; mimetype?: string; caption?: string }
interface UazapiMensagem {
  messageid?: string
  fromMe?: boolean
  messageType?: string
  mediaType?: string
  text?: string
  content?: string | UazapiMidia
  chatid?: string
  sender_pn?: string
  senderName?: string
  messageTimestamp?: number
}
interface UazapiEnvelope {
  EventType?: string
  message?: UazapiMensagem
  event?: { MessageIDs?: string[]; Type?: string }
  instance?: { name?: string; status?: string }
  
  instanceName?: string
}


function mapKind(mediaType: string | undefined): InboundMidia['kind'] | null {
  switch (mediaType) {
    case 'image': return 'imagem'
    case 'ptt':
    case 'audio': return 'audio'
    case 'video': return 'video'
    case 'document': return 'documento'
    default: return null
  }
}


const ACK: Record<string, StatusEntregaProvider> = Object.assign(Object.create(null), {
  Delivered: 'delivered',
  Read: 'read',
  Sent: 'sent',
  Failed: 'failed',
})



function tipoDoChat(chatid: string): TipoChat {
  
  
  
  
  
  if (chatid.endsWith('@s.whatsapp.net') || chatid.endsWith('@c.us')) return 'individual'
  if (chatid.endsWith('@g.us')) return 'grupo'
  if (chatid.endsWith('@broadcast')) return 'broadcast'
  return 'outro' 
}


export const LIMITE_ACKS = 500


const LIMITE_URL_MIDIA = 2048


const LIMITE_MIME = 100
const FORMA_MIME = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i

function mimeDoEnvelope(bruto: unknown): string | undefined {
  
  
  const limpo = limparTexto(bruto, LIMITE_MIME + 1).trim()
  if (!limpo) return undefined
  if (limpo.length > LIMITE_MIME) return undefined
  
  
  if (/[\r\n]/.test(limpo)) return undefined
  return FORMA_MIME.test(limpo.split(';')[0].trim()) ? limpo : undefined
}

function refDeMidia(bruta: string | undefined): string | undefined {
  return bruta && bruta.length <= LIMITE_URL_MIDIA ? bruta : undefined
}

function parseMensagem(m: UazapiMensagem, agoraMs: number): CanalEvent | null {
  
  
  
  
  
  
  const externalId = comoId(m.messageid)
  const conversaExterna = comoTexto(m.chatid)
  if (!externalId || !conversaExterna) return null

  const tipoChat = tipoDoChat(conversaExterna)

  const kind = mapKind(m.mediaType)
  const conteudo = typeof m.content === 'object' && m.content !== null ? m.content : null
  const urlMidia = refDeMidia(comoTexto(conteudo?.URL))
  const midia: InboundMidia | null =
    kind && urlMidia
      ? {
          kind,
          mime: mimeDoEnvelope(conteudo?.mimetype),
          
          
          
          
          
          refExterna: refNaoValidada(urlMidia),
          
          
          
          legenda: limparTexto(conteudo?.caption, LIMITE_TEXTO),
        }
      : null

  const senderPn = comoTexto(m.sender_pn)
  const nome = comoTexto(m.senderName)

  return {
    tipo: 'mensagem',
    externalId,
    conversaExterna,
    tipoChat,
    
    
    
    
    
    
    
    
    
    remetente: normalizarTelefone(senderPn ?? (tipoChat === 'individual' ? conversaExterna : undefined)),
    
    
    
    
    
    
    identidadeExterna: null,
    nomeRemetente: nome ? limparTexto(nome, LIMITE_NOME) : null,
    
    
    
    
    
    
    
    timestamp: isoDeCarimbo(m.messageTimestamp, agoraMs),
    texto: limparTexto(comoTexto(m.text) ?? (typeof m.content === 'string' ? m.content : ''), LIMITE_TEXTO),
    midia,
    
    
    
    
    
    
    
    
    origem: m.fromMe === true ? 'aparelho' : 'contato',
  }
}

export const uazapiAdapter: CanalAdapter = {
  slug: 'uazapi',
  
  capabilities: {
    enviaMidia: true,
    markRead: true,
    conexaoPareada: true,
    precisaCredencial: true,
    janela24h: false,
    
    
    
    
    
    identidadePorTelefone: true,
    
    
    sintaxeWhatsapp: true,
    
    
    
    ecoaEnvioProprio: true,
    
    recebePorWebhook: true,
  },

  
  parse(envelope: unknown, agoraMs: number = Date.now(), corte?: CorteDoEnvelope): CanalEvent[] {
    if (!envelope || typeof envelope !== 'object') return []
    const env = envelope as UazapiEnvelope

    
    
    
    
    
    switch (env.EventType) {
      case 'messages':
        return parseMensagens(env, agoraMs)
      case 'messages_update':
        return parseAcks(env, corte)
      case 'connection':
        return parseConexao(env)
      default:
        
        
        return []
    }
  },

  
  async enviarTexto(
    creds: CanalCreds | null,
    destino: string,
    texto: string,
    deps: HttpDeps = {},
  ): Promise<EnvioResultado> {
    
    
    
    
    
    
    
    
    
    
    
    if (!creds) {
      return { ok: false, erro: 'canal sem credencial configurada', codigoHttp: null }
    }

    
    
    
    
    
    
    
    
    
    if (creds.tipo !== 'uazapi') {
      return { ok: false, erro: 'canal sem credencial configurada', codigoHttp: null }
    }

    const http = deps.fetchFn ?? fetch
    
    
    
    
    const segredos = segredosDe(creds)

    let r: Response
    try {
      r = await http(`${creds.serverUrl}/send/text`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', token: creds.token },
        body: JSON.stringify({ number: destino, text: texto }),
        
        
        
        
        
        signal: AbortSignal.timeout(TIMEOUT_ENVIO_MS),
      })
    } catch (err) {
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      return {
        ok: false,
        erro: redigirValores(err, segredos),
        codigoHttp: null,
        causa: causaDaFalhaSemResposta(err),
      }
    }

    if (!r.ok) {
      return { ok: false, erro: redigirValores(`HTTP ${r.status}`, segredos), codigoHttp: r.status }
    }

    
    
    
    
    
    let externalId: string | undefined
    try {
      const corpo = (await r.json()) as { messageid?: string; id?: string }
      externalId = corpo.messageid ?? corpo.id
    } catch {
      externalId = undefined
    }

    if (!externalId) {
      return {
        ok: false,
        erro:
          'O servidor de mensagens aceitou o envio (HTTP 200) mas não confirmou a entrega; confira o WhatsApp antes de reenviar.',
        codigoHttp: r.status, 
      }
    }
    return { ok: true, externalId }
  },

  
  async resolverMidia(
    entrada: { externoId: string | null },
    creds: CanalCreds | null,
    deps: HttpDeps = {},
  ): Promise<RefExternaMidia | null> {
    
    
    if (!entrada.externoId) return null
    const segredos = creds && creds.tipo === 'uazapi' ? creds : null
    if (!segredos) return null

    try {
      const r = await (deps.fetchFn ?? fetch)(`${segredos.serverUrl}/message/download`, {
        method: 'POST',
        headers: { token: segredos.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entrada.externoId,
          return_link: true,
          return_base64: false,
          generate_mp3: false,
        }),
        signal: AbortSignal.timeout(TIMEOUT_RESOLVER_MIDIA_MS),
      })
      if (!r.ok) return null
      const corpo = (await r.json()) as { fileURL?: unknown }
      
      
      
      const link = comoTexto(corpo.fileURL)
      return link ? refNaoValidada(link) : null
    } catch {
      
      
      return null
    }
  },
}

function parseMensagens(env: UazapiEnvelope, agoraMs: number): CanalEvent[] {
  if (!env.message) return []
  const ev = parseMensagem(env.message, agoraMs)
  return ev ? [ev] : []
}

function parseAcks(env: UazapiEnvelope, corte?: CorteDoEnvelope): CanalEvent[] {
  
  
  
  
  
  const ids = env.event?.MessageIDs
  if (!Array.isArray(ids) || ids.length === 0) return []
  
  
  
  
  
  
  
  
  
  
  
  
  
  const status = ACK[comoTexto(env.event?.Type) ?? '']
  if (!status) return []
  
  
  contarCorte(corte, ids.length, LIMITE_ACKS)
  return ids
    
    
    .slice(0, LIMITE_ACKS)
    
    
    
    
    
    
    
    
    .map((id) => comoId(id))
    .filter((id): id is string => id !== undefined && id.length > 0)
    .map((id) => ({ tipo: 'status' as const, externalId: id, status }))
}

function parseConexao(env: UazapiEnvelope): CanalEvent[] {
  
  
  
  
  
  
  
  
  
  
  
  
  const externalId = comoTexto(nomeDaInstancia(env))
  if (!externalId) return []
  return [{
    tipo: 'conexao',
    externalId,
    conectado: env.instance?.status === 'connected',
  }]
}
