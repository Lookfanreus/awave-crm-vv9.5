







import { causaDaFalhaSemResposta } from '@/lib/canais/erroMeta'
import { isoDeCarimbo } from '@/lib/canais/carimbo'
import { redigirValores } from '@/lib/canais/redigir'
import { verificarAssinaturaMeta } from '@/server/canais/providers/assinatura-meta'
import {
  comoId,
  comoTexto,
  contarCorte,
  limparTexto,
  LIMITE_TEXTO,
} from '@/server/canais/providers/fronteira'
import { SLUG_INSTAGRAM, segredosDe } from '@/server/canais/types'
import type {
  CanalAdapter,
  CanalCreds,
  CanalEvent,
  CorteDoEnvelope,
  EnvioResultado,
  GrupoPorIdentidade,
  HttpDeps,
} from '@/server/canais/types'


export const GRAPH_BASE = 'https://graph.facebook.com/v26.0'


const TIMEOUT_ENVIO_MS = 20_000









const LIMITE_ENTRY = 50
const LIMITE_MENSAGENS = 100

const LIMITE_EVENTOS = 500


type EntradaDoCanal = {
  
  identidade: string
  
  messaging: unknown[]
}


function entradasDoCanal(envelope: unknown, corte?: CorteDoEnvelope): EntradaDoCanal[] {
  const saida: EntradaDoCanal[] = []
  if (!envelope || typeof envelope !== 'object') return saida
  const entries = (envelope as { entry?: unknown }).entry
  if (!Array.isArray(entries)) return saida

  contarCorte(corte, entries.length, LIMITE_ENTRY)
  for (const entry of entries.slice(0, LIMITE_ENTRY)) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as { id?: unknown; messaging?: unknown; standby?: unknown }
    if (!Array.isArray(e.messaging) && !Array.isArray(e.standby)) continue
    
    
    
    
    
    
    saida.push({
      identidade: comoId(e.id) ?? '',
      messaging: Array.isArray(e.messaging) ? cortarMensagens(e.messaging, corte) : [],
    })
  }
  return saida
}


function cortarMensagens(messaging: unknown[], corte?: CorteDoEnvelope): unknown[] {
  contarCorte(corte, messaging.length, LIMITE_MENSAGENS)
  return messaging.slice(0, LIMITE_MENSAGENS)
}


const NAO_E_MENSAGEM_DE_TEXTO = [
  'reaction',
  'postback',
  'read',
  'delivery',
  'messaging_referral',
  'message_edit',
] as const


function idDoLado(bruto: unknown): string | undefined {
  return bruto && typeof bruto === 'object' ? comoId((bruto as { id?: unknown }).id) : undefined
}


function msDoCarimbo(bruto: unknown): number | undefined {
  if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : undefined
  const texto = comoTexto(bruto)
  const n = texto !== undefined ? Number(texto) : NaN
  return Number.isFinite(n) ? n : undefined
}


function parseMensagem(bruta: unknown, agoraMs: number): CanalEvent | null {
  if (!bruta || typeof bruta !== 'object') return null
  const item = bruta as Record<string, unknown>
  for (const campo of NAO_E_MENSAGEM_DE_TEXTO) if (campo in item) return null

  const msg = item.message
  if (!msg || typeof msg !== 'object') return null
  const m = msg as {
    mid?: unknown
    text?: unknown
    is_echo?: unknown
    attachments?: unknown
    reply_to?: unknown
    is_deleted?: unknown
    is_unsupported?: unknown
  }
  
  
  if ('attachments' in m) return null

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if ('reply_to' in m || m.is_deleted === true || m.is_unsupported === true) return null

  const externalId = comoId(m.mid)
  if (!externalId) return null
  const texto = limparTexto(m.text, LIMITE_TEXTO).trim()
  if (!texto) return null

  
  
  
  
  
  
  
  
  
  
  const eco = 'is_echo' in m && m.is_echo !== false
  const de = idDoLado(item.sender)
  const para = idDoLado(item.recipient)
  if (!de) return null

  
  
  
  
  
  
  
  
  
  
  
  const interlocutor = eco ? para : de
  if (!interlocutor) return null

  return {
    tipo: 'mensagem',
    externalId,
    conversaExterna: interlocutor,
    
    tipoChat: 'individual',
    
    
    
    remetente: null,
    
    
    
    identidadeExterna: de,
    
    
    nomeRemetente: null,
    timestamp: isoDeCarimbo(msDoCarimbo(item.timestamp), agoraMs),
    texto,
    midia: null,
    origem: eco ? 'aparelho' : 'contato',
  }
}


function gruposDoEnvelope(
  envelope: unknown,
  agoraMs: number,
  corte?: CorteDoEnvelope,
): GrupoPorIdentidade[] {
  const grupos: GrupoPorIdentidade[] = []
  const indice = new Map<string, number>()
  let restante = LIMITE_EVENTOS

  const lista = entradasDoCanal(envelope, corte)
  for (let i = 0; i < lista.length; i++) {
    const { identidade, messaging } = lista[i]
    if (restante <= 0) {
      contarCorte(corte, lista.length, i)
      break
    }
    let posicao = indice.get(identidade)
    if (posicao === undefined) {
      posicao = grupos.length
      indice.set(identidade, posicao)
      grupos.push({ identidade, eventos: [] })
    }
    const eventos = grupos[posicao].eventos
    
    
    
    if (!identidade) continue

    contarCorte(corte, messaging.length, restante)
    for (const item of messaging.slice(0, restante)) {
      
      restante--
      const ev = parseMensagem(item, agoraMs)
      if (ev) eventos.push(ev)
    }
  }
  return grupos
}

export const instagramAdapter: CanalAdapter = {
  slug: SLUG_INSTAGRAM,

  
  capabilities: {
    enviaMidia: false,
    markRead: false,
    conexaoPareada: false,
    precisaCredencial: true,
    janela24h: true,
    identidadePorTelefone: false,
    
    
    
    sintaxeWhatsapp: false,
    
    
    
    
    ecoaEnvioProprio: true,
    
    recebePorWebhook: true,
  },

  
  parse: (envelope: unknown, agoraMs: number = Date.now(), corte?: CorteDoEnvelope): CanalEvent[] =>
    gruposDoEnvelope(envelope, agoraMs, corte).flatMap((g) => g.eventos),

  
  eventosPorIdentidade: (
    envelope: unknown,
    agoraMs: number = Date.now(),
    corte?: CorteDoEnvelope,
  ): GrupoPorIdentidade[] => gruposDoEnvelope(envelope, agoraMs, corte),

  
  identidadesDaInstancia: (envelope: unknown): string[] =>
    entradasDoCanal(envelope).map((e) => e.identidade),

  
  verificarAssinaturaCrua: verificarAssinaturaMeta,

  
  enviarTexto: async (
    creds: CanalCreds | null,
    destino: string,
    texto: string,
    deps: HttpDeps = {},
  ): Promise<EnvioResultado> => {
    
    
    
    
    
    
    
    
    if (!creds) {
      return { ok: false, erro: 'canal sem credencial configurada', codigoHttp: null }
    }

    
    
    
    
    if (creds.tipo !== SLUG_INSTAGRAM) {
      return { ok: false, erro: 'canal sem credencial configurada', codigoHttp: null }
    }

    const http = deps.fetchFn ?? fetch
    
    
    
    const segredos = segredosDe(creds)

    let r: Response
    try {
      
      
      
      r = await http(`${GRAPH_BASE}/${creds.contaId}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${creds.accessToken}`,
        },
        body: JSON.stringify({ recipient: { id: destino }, message: { text: texto } }),
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
      
      
      const codigo = await codigoDeErroDaMeta(r)
      const base = codigo ? `HTTP ${r.status} (Meta ${codigo})` : `HTTP ${r.status}`
      return {
        ok: false,
        erro: redigirValores(base, segredos),
        codigoHttp: r.status,
        codigoProvider: codigo ?? null,
      }
    }

    
    
    
    let externalId: string | undefined
    try {
      const corpo = (await r.json()) as { message_id?: unknown }
      externalId = comoId(corpo?.message_id)
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
}


async function codigoDeErroDaMeta(r: Response): Promise<string | undefined> {
  try {
    const corpo = (await r.json()) as { error?: { code?: unknown; error_subcode?: unknown } }
    const erro = corpo?.error
    if (!erro || typeof erro !== 'object') return undefined
    return comoId(erro.error_subcode) ?? comoId(erro.code)
  } catch {
    return undefined
  }
}
