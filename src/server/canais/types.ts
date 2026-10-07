









import type { CausaSemResposta } from '@/lib/canais/erroMeta'
import type { StatusEntregaProvider } from '@/lib/canais/janela'


export const SLUG_CLOUD = 'whatsapp_cloud'


export const SLUG_UAZAPI = 'uazapi'


export const SLUG_INSTAGRAM = 'instagram'


export const SLUGS = [SLUG_UAZAPI, 'simulador', SLUG_CLOUD, SLUG_INSTAGRAM] as const
export type ProviderSlug = (typeof SLUGS)[number]


export function ehProviderSlug(x: string): x is ProviderSlug {
  return (SLUGS as readonly string[]).includes(x)
}


export const PISO_SEGREDO_CANAL = 8


export type CredsUazapi = {
  readonly __validado: unique symbol
  readonly tipo: typeof SLUG_UAZAPI
  readonly serverUrl: string
  readonly token: string
}

export type CredsCloud = {
  readonly __validadoCloud: unique symbol
  readonly tipo: typeof SLUG_CLOUD
  readonly accessToken: string
  
  readonly phoneNumberId: string
}


export type CredsInstagram = {
  readonly __validadoInstagram: unique symbol
  readonly tipo: typeof SLUG_INSTAGRAM
  readonly accessToken: string
  
  readonly contaId: string
}

export type CanalCreds = CredsUazapi | CredsCloud | CredsInstagram


export function segredosDe(creds: CanalCreds): string[] {
  switch (creds.tipo) {
    case SLUG_UAZAPI:
      return [creds.token, creds.serverUrl]
    case SLUG_CLOUD:
      return [creds.accessToken]
    
    
    case SLUG_INSTAGRAM:
      return [creds.accessToken]
    default: {
      const _exaustivo: never = creds
      return _exaustivo
    }
  }
}


export function credenciaisDeCanal(bruto: {
  serverUrl: string
  token: string
}): CanalCreds | null {
  const serverUrl = typeof bruto?.serverUrl === 'string' ? bruto.serverUrl.trim() : ''
  const token = typeof bruto?.token === 'string' ? bruto.token.trim() : ''
  if (serverUrl.length < PISO_SEGREDO_CANAL || token.length < PISO_SEGREDO_CANAL) return null
  return { tipo: SLUG_UAZAPI, serverUrl, token } as unknown as CanalCreds
}


const ID_DE_CONTA = /^\d+$/


export function credenciaisCloud(bruto: {
  accessToken: string
  phoneNumberId: string
}): CanalCreds | null {
  const accessToken = typeof bruto?.accessToken === 'string' ? bruto.accessToken.trim() : ''
  const phoneNumberId = typeof bruto?.phoneNumberId === 'string' ? bruto.phoneNumberId.trim() : ''
  if (accessToken.length < PISO_SEGREDO_CANAL) return null
  if (!ID_DE_CONTA.test(phoneNumberId)) return null
  
  
  
  
  
  return { tipo: SLUG_CLOUD, accessToken, phoneNumberId } as unknown as CanalCreds
}


export function credenciaisInstagram(bruto: {
  accessToken: string
  contaId: string
}): CanalCreds | null {
  const accessToken = typeof bruto?.accessToken === 'string' ? bruto.accessToken.trim() : ''
  const contaId = typeof bruto?.contaId === 'string' ? bruto.contaId.trim() : ''
  if (accessToken.length < PISO_SEGREDO_CANAL) return null
  if (!ID_DE_CONTA.test(contaId)) return null
  return { tipo: SLUG_INSTAGRAM, accessToken, contaId } as unknown as CanalCreds
}


export interface HttpDeps {
  fetchFn?: typeof fetch
}


export type RefExternaMidia = {
  readonly __naoValidada: unique symbol
  
  readonly valor: string
}


export function refNaoValidada(bruta: string): RefExternaMidia {
  return { valor: typeof bruta === 'string' ? bruta : '' } as unknown as RefExternaMidia
}


export type TipoChat = 'individual' | 'grupo' | 'broadcast' | 'outro'

export interface InboundMidia {
  kind: 'imagem' | 'audio' | 'video' | 'documento'
  mime?: string
  refExterna: RefExternaMidia
  
  legenda?: string
}

export type CanalEvent =
  | {
      
      tipo: 'mensagem'
      externalId: string
      
      conversaExterna: string
      
      tipoChat: TipoChat
      
      remetente: string | null
      
      identidadeExterna: string | null
      nomeRemetente: string | null
      
      timestamp: string
      
      texto: string
      midia: InboundMidia | null
      
      origem: 'contato' | 'aparelho'
    }
  | { tipo: 'status'; externalId: string; status: StatusEntregaProvider }
  | { tipo: 'conexao'; externalId: string; conectado: boolean }

export type EnvioResultado =
  | { ok: true; externalId: string }
  | {
      ok: false
      erro: string
      
      codigoHttp: number | null
      
      causa?: CausaSemResposta
      
      codigoProvider?: string | null
    }

export interface CanalCapabilities {
  enviaMidia: boolean
  markRead: boolean
  
  conexaoPareada: boolean
  
  precisaCredencial: boolean
  
  janela24h: boolean
  
  identidadePorTelefone: boolean
  
  sintaxeWhatsapp: boolean
  
  ecoaEnvioProprio: boolean
  
  recebePorWebhook: boolean
}


export interface CorteDoEnvelope {
  descartados: number
}


export interface GrupoPorIdentidade {
  identidade: string
  eventos: CanalEvent[]
}

export interface CanalAdapter {
  slug: ProviderSlug
  capabilities: CanalCapabilities
  
  parse(envelope: unknown, agoraMs?: number, corte?: CorteDoEnvelope): CanalEvent[]
  
  verificarAssinaturaCrua?: (
    entrada: { raw: string; bytes: Uint8Array; headers: Record<string, string> },
    segredo: string,
  ) => boolean
  
  identidadesDaInstancia?: (envelope: unknown) => string[]
  
  eventosPorIdentidade?: (
    envelope: unknown,
    agoraMs?: number,
    corte?: CorteDoEnvelope,
  ) => GrupoPorIdentidade[]
  
  enviarTexto: (
    creds: CanalCreds | null,
    destino: string,
    texto: string,
    deps?: HttpDeps,
  ) => Promise<EnvioResultado>
  
  resolverMidia?: (
    entrada: { externoId: string | null },
    creds: CanalCreds | null,
    deps?: HttpDeps,
  ) => Promise<RefExternaMidia | null>
}
