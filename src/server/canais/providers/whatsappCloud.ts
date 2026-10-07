








import { causaDaFalhaSemResposta } from '@/lib/canais/erroMeta'
import { isoDeCarimbo } from '@/lib/canais/carimbo'
import { redigirValores } from '@/lib/canais/redigir'
import { normalizarTelefone } from '@/lib/canais/telefone'
import { verificarAssinaturaMeta } from '@/server/canais/providers/assinatura-meta'
import {
  comoId,
  comoTexto,
  contarCorte,
  limparTexto,
  LIMITE_NOME,
  LIMITE_TEXTO,
} from '@/server/canais/providers/fronteira'
import { SLUG_CLOUD, segredosDe } from '@/server/canais/types'
import type {
  CanalAdapter,
  CanalCreds,
  CanalEvent,
  CorteDoEnvelope,
  EnvioResultado,
  GrupoPorIdentidade,
  HttpDeps,
} from '@/server/canais/types'
import type { StatusEntregaProvider } from '@/lib/canais/janela'


const GRAPH_BASE = 'https://graph.facebook.com/v26.0'


const TIMEOUT_ENVIO_MS = 20_000












const LIMITE_ENTRY = 20
const LIMITE_CHANGES = 20

const LIMITE_EVENTOS = 500


const STATUS: Record<string, StatusEntregaProvider> = Object.assign(Object.create(null), {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
})


interface ValueCloud {
  metadata?: { phone_number_id?: unknown }
  contacts?: unknown
  messages?: unknown
  statuses?: unknown
}


function changesComEvento(
  envelope: unknown,
  corte?: CorteDoEnvelope,
): Array<{ identidade: string; value: ValueCloud }> {
  const saida: Array<{ identidade: string; value: ValueCloud }> = []
  if (!envelope || typeof envelope !== 'object') return saida
  const entries = (envelope as { entry?: unknown }).entry
  if (!Array.isArray(entries)) return saida

  contarCorte(corte, entries.length, LIMITE_ENTRY)
  for (const entry of entries.slice(0, LIMITE_ENTRY)) {
    if (!entry || typeof entry !== 'object') continue
    const changes = (entry as { changes?: unknown }).changes
    if (!Array.isArray(changes)) continue

    contarCorte(corte, changes.length, LIMITE_CHANGES)
    for (const change of changes.slice(0, LIMITE_CHANGES)) {
      if (!change || typeof change !== 'object') continue
      const value = (change as { value?: unknown }).value
      if (!value || typeof value !== 'object') continue
      const v = value as ValueCloud
      if (!Array.isArray(v.messages) && !Array.isArray(v.statuses)) continue
      const metadata = v.metadata
      const bruta = metadata && typeof metadata === 'object' ? metadata.phone_number_id : undefined
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      saida.push({ identidade: comoId(bruta) ?? '', value: v })
    }
  }
  return saida
}


function msDoCarimbo(bruto: unknown): number | undefined {
  const texto = comoTexto(bruto)
  const segundos = texto !== undefined ? Number(texto) : typeof bruto === 'number' ? bruto : NaN
  return Number.isFinite(segundos) ? segundos * 1000 : undefined
}


function nomeDoRemetente(value: ValueCloud, de: string | undefined): string | null {
  if (!de || !Array.isArray(value.contacts)) return null
  for (const c of value.contacts.slice(0, LIMITE_EVENTOS)) {
    if (!c || typeof c !== 'object') continue
    const contato = c as { wa_id?: unknown; profile?: { name?: unknown } }
    if (comoTexto(contato.wa_id) !== de) continue
    const perfil = contato.profile
    const nome = perfil && typeof perfil === 'object' ? limparTexto(perfil.name, LIMITE_NOME) : ''
    return nome.length > 0 ? nome : null
  }
  return null
}

function parseMensagem(bruta: unknown, value: ValueCloud, agoraMs: number): CanalEvent | null {
  if (!bruta || typeof bruta !== 'object') return null
  const m = bruta as { id?: unknown; from?: unknown; timestamp?: unknown; type?: unknown; text?: { body?: unknown } }

  
  
  const externalId = comoId(m.id)
  const de = comoTexto(m.from)
  if (!externalId || !de) return null

  
  
  
  
  if (comoTexto(m.type) !== 'text') return null
  const texto = m.text && typeof m.text === 'object' ? limparTexto(m.text.body, LIMITE_TEXTO) : ''

  return {
    tipo: 'mensagem',
    externalId,
    
    
    conversaExterna: de,
    tipoChat: 'individual',
    remetente: normalizarTelefone(de),
    
    
    
    identidadeExterna: null,
    nomeRemetente: nomeDoRemetente(value, de),
    timestamp: isoDeCarimbo(msDoCarimbo(m.timestamp), agoraMs),
    texto,
    midia: null,
    origem: 'contato',
  }
}

function parseStatus(bruto: unknown): CanalEvent | null {
  if (!bruto || typeof bruto !== 'object') return null
  const s = bruto as { id?: unknown; status?: unknown }
  const externalId = comoId(s.id)
  const status = STATUS[comoTexto(s.status) ?? '']
  if (!externalId || !status) return null
  return { tipo: 'status', externalId, status }
}


function gruposDoEnvelope(
  envelope: unknown,
  agoraMs: number,
  corte?: CorteDoEnvelope,
): GrupoPorIdentidade[] {
  const grupos: GrupoPorIdentidade[] = []
  const indice = new Map<string, number>()
  let restante = LIMITE_EVENTOS

  const lista = changesComEvento(envelope, corte)
  for (let i = 0; i < lista.length; i++) {
    const { identidade, value } = lista[i]
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

    if (Array.isArray(value.messages)) {
      contarCorte(corte, value.messages.length, restante)
      for (const m of value.messages.slice(0, restante)) {
        
        restante--
        const ev = parseMensagem(m, value, agoraMs)
        if (ev) eventos.push(ev)
      }
    }

    if (Array.isArray(value.statuses)) {
      contarCorte(corte, value.statuses.length, Math.max(restante, 0))
      for (const s of value.statuses.slice(0, Math.max(restante, 0))) {
        restante--
        const ev = parseStatus(s)
        if (ev) eventos.push(ev)
      }
    }
  }
  return grupos
}

export const whatsappCloudAdapter: CanalAdapter = {
  slug: SLUG_CLOUD,

  
  capabilities: {
    enviaMidia: false,
    markRead: false,
    conexaoPareada: false,
    precisaCredencial: true,
    janela24h: true,
    
    
    
    identidadePorTelefone: true,
    
    sintaxeWhatsapp: true,
    
    
    
    
    ecoaEnvioProprio: false,
    
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
    changesComEvento(envelope).map((c) => c.identidade),

  
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

    
    
    
    
    if (creds.tipo !== SLUG_CLOUD) {
      return { ok: false, erro: 'canal sem credencial configurada', codigoHttp: null }
    }

    const http = deps.fetchFn ?? fetch
    
    
    
    const segredos = segredosDe(creds)

    let r: Response
    try {
      
      
      
      r = await http(`${GRAPH_BASE}/${creds.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${creds.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: destino,
          type: 'text',
          text: { body: texto, preview_url: false },
        }),
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
      const corpo = (await r.json()) as { messages?: unknown }
      const primeira = Array.isArray(corpo?.messages) ? corpo.messages[0] : undefined
      externalId = primeira && typeof primeira === 'object' ? comoId((primeira as { id?: unknown }).id) : undefined
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
    const corpo = (await r.json()) as { error?: { code?: unknown } }
    const erro = corpo?.error
    return erro && typeof erro === 'object' ? comoId(erro.code) : undefined
  } catch {
    return undefined
  }
}
