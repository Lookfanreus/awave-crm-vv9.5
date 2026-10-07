













import 'server-only'
import { iguaisTimingSafe } from '@/server/http/timing-safe'
import type { CorpoCru } from '@/server/http/readBodyCapped'
import { admin } from '@/server/supabase'
import { getSecret as getSecretReal } from '@/server/secrets'
import { chaveAppSecret, chaveToken, chaveWebhook } from '@/server/canais/segredos'


import {
  conferirIdentidade,
  nomeDaInstancia,
  tokenDeclarado,
  type MotivoDaRecusa,
} from '@/lib/canais/identidade-do-envelope'
import { uazapiAdapter } from '@/server/canais/providers/uazapi'
import { simuladorAdapter } from '@/server/canais/providers/simulador'
import { whatsappCloudAdapter } from '@/server/canais/providers/whatsappCloud'
import { instagramAdapter } from '@/server/canais/providers/instagram'
import {
  ehProviderSlug,
  SLUG_CLOUD,
  SLUG_INSTAGRAM,
  type CanalAdapter,
  type ProviderSlug,
} from '@/server/canais/types'

export interface CanalRow {
  id: string
  workspace_id: string
  
  provider: string
  external_id: string | null
  config: { server_url?: string }
  
  agente_ligado: boolean
}


const ADAPTERS: Record<ProviderSlug, CanalAdapter> = {
  uazapi: uazapiAdapter,
  simulador: simuladorAdapter,
  
  
  
  
  [SLUG_CLOUD]: whatsappCloudAdapter,
  
  
  
  
  [SLUG_INSTAGRAM]: instagramAdapter,
}


export function getProvider(slug: string): CanalAdapter | null {
  return ehProviderSlug(slug) ? ADAPTERS[slug] : null
}


type LeituraDeCanal = { canal: CanalRow | null } | { erro: true }


type LeituraDeCanais = { canais: CanalRow[] } | { erro: true }


const TETO_CANAIS_IRMAOS = 50


function ehIdMalformado(erro: { code?: string } | null | undefined): boolean {
  return erro?.code === '22P02'
}

async function getCanalReal(id: string): Promise<LeituraDeCanal> {
  const { data, error } = await admin()
    .from('canais')
    .select('id, workspace_id, provider, external_id, config, agente_ligado')
    .eq('id', id)
    .maybeSingle()
  
  
  
  if (error && !ehIdMalformado(error)) return { erro: true }
  return { canal: (data as CanalRow | null) ?? null }
}


async function getCanaisDoWorkspaceReal(
  workspaceId: string,
  provider: string,
): Promise<LeituraDeCanais> {
  const { data, error } = await admin()
    .from('canais')
    .select('id, workspace_id, provider, external_id, config, agente_ligado')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .not('external_id', 'is', null)
    .order('criado_em')
    .limit(TETO_CANAIS_IRMAOS)
  if (error) return { erro: true }
  return { canais: (data as CanalRow[] | null) ?? [] }
}

export interface Deps {
  getSecret?: (nome: string) => Promise<string | null>
  getCanal?: (id: string) => Promise<LeituraDeCanal>
  getCanaisDoWorkspace?: (workspaceId: string, provider: string) => Promise<LeituraDeCanais>
}


export async function verificarRequest(
  entrada: { provider: string; segmentos: string[] },
  deps: Deps = {},
): Promise<{ ok: true; canal: CanalRow } | { ok: false; status: 401 | 404 | 503 }> {
  const getSecret = deps.getSecret ?? getSecretReal
  const getCanal = deps.getCanal ?? getCanalReal

  const adapter = getProvider(entrada.provider)
  if (!adapter) return { ok: false, status: 404 }
  
  
  
  if (!adapter.capabilities.recebePorWebhook) return { ok: false, status: 401 }

  
  
  
  
  if (entrada.segmentos.length !== 2) return { ok: false, status: 401 }

  const [canalId, segredo] = entrada.segmentos
  if (!canalId || !segredo) return { ok: false, status: 401 }

  const leitura = await getCanal(canalId)
  
  
  
  
  if ('erro' in leitura) return { ok: false, status: 503 }
  const canal = leitura.canal
  
  
  
  if (!canal) return { ok: false, status: 401 }

  
  
  
  
  
  if (canal.provider !== entrada.provider) return { ok: false, status: 401 }

  const esperado = await getSecret(chaveWebhook(canalId))
  
  if (!esperado) return { ok: false, status: 503 }

  return iguaisTimingSafe(segredo, esperado) ? { ok: true, canal } : { ok: false, status: 401 }
}


export type VeredictoDeEvento = 'ok' | 'recusado' | 'indisponivel'


export type MotivoDoEvento = MotivoDaRecusa | 'corpo_invalido'
export type ResultadoDoEvento =
  | { veredito: 'ok' | 'indisponivel' }
  | { veredito: 'recusado'; motivo: MotivoDoEvento }


export async function verificarEvento(
  canal: CanalRow,
  envelope: unknown,
  deps: Deps = {},
): Promise<ResultadoDoEvento> {
  const getSecret = deps.getSecret ?? getSecretReal
  
  if (!envelope || typeof envelope !== 'object') return { veredito: 'recusado', motivo: 'corpo_invalido' }

  const token = await getSecret(chaveToken(canal.id))
  
  
  
  
  
  
  
  if (!token) return { veredito: 'indisponivel' }

  
  
  
  
  
  
  const r = conferirIdentidade(
    {
      tokenDeclarado: tokenDeclarado(envelope),
      nomeDaInstancia: nomeDaInstancia(envelope),
      tokenDoCanal: token,
      externalId: canal.external_id,
    },
    iguaisTimingSafe,
  )
  return r.ok ? { veredito: 'ok' } : { veredito: 'recusado', motivo: r.motivo }
}


export async function conferirAssinatura(
  canal: CanalRow,
  adapter: CanalAdapter,
  corpo: CorpoCru,
  headers: Record<string, string>,
  deps: Deps = {},
): Promise<VeredictoDeEvento> {
  if (!adapter.verificarAssinaturaCrua) return 'ok'
  const getSecret = deps.getSecret ?? getSecretReal
  const segredo = await getSecret(chaveAppSecret(canal.id))
  if (segredo == null) return 'indisponivel'
  return adapter.verificarAssinaturaCrua({ ...corpo, headers }, segredo) ? 'ok' : 'recusado'
}


export type VeredictoDeIdentidade = 'ok' | 'recusado' | 'sem_identidade' | 'indisponivel'


export type CanaisDoEnvelope =
  | { veredicto: 'sem_identidade' }
  | { veredicto: 'recusado' }
  | { veredicto: 'indisponivel' }
  | { veredicto: 'ok'; canais: Map<string, CanalRow>; estranhas: number }


export async function resolverCanaisDoEnvelope(
  canalDaUrl: CanalRow,
  envelope: unknown,
  adapter: CanalAdapter,
  corpo: CorpoCru,
  headers: Record<string, string>,
  deps: Deps = {},
): Promise<CanaisDoEnvelope> {
  
  
  if (!adapter.identidadesDaInstancia) return { veredicto: 'sem_identidade' }
  const getCanaisDoWorkspace = deps.getCanaisDoWorkspace ?? getCanaisDoWorkspaceReal

  const vistas = adapter.identidadesDaInstancia(envelope)
  if (vistas.length === 0) return { veredicto: 'sem_identidade' }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (!canalDaUrl.external_id) return { veredicto: 'recusado' }
  
  
  const distintas = [...new Set(vistas)]

  
  
  
  if (distintas.length === 1 && canalDaUrl.external_id && distintas[0] === canalDaUrl.external_id) {
    return {
      veredicto: 'ok',
      canais: new Map([[canalDaUrl.external_id, canalDaUrl]]),
      estranhas: 0,
    }
  }

  const leitura = await getCanaisDoWorkspace(canalDaUrl.workspace_id, canalDaUrl.provider)
  if ('erro' in leitura) return { veredicto: 'indisponivel' }

  const porIdentidade = new Map<string, CanalRow>()
  for (const linha of leitura.canais) {
    
    
    
    
    
    if (linha.workspace_id !== canalDaUrl.workspace_id) continue
    if (linha.provider !== canalDaUrl.provider) continue
    if (!linha.external_id) continue
    porIdentidade.set(linha.external_id, linha)
  }
  
  if (canalDaUrl.external_id) porIdentidade.set(canalDaUrl.external_id, canalDaUrl)

  const canais = new Map<string, CanalRow>()
  let estranhas = 0
  for (const identidade of distintas) {
    
    const alvo = identidade ? porIdentidade.get(identidade) : undefined
    if (!alvo) {
      estranhas++
      continue
    }
    if (alvo.id === canalDaUrl.id) {
      canais.set(identidade, alvo)
      continue
    }
    
    if (!adapter.verificarAssinaturaCrua) {
      estranhas++
      continue
    }
    
    const assinatura = await conferirAssinatura(alvo, adapter, corpo, headers, deps)
    if (assinatura === 'indisponivel') return { veredicto: 'indisponivel' }
    if (assinatura === 'recusado') {
      estranhas++
      continue
    }
    canais.set(identidade, alvo)
  }

  
  if (canais.size === 0) return { veredicto: 'recusado' }
  return { veredicto: 'ok', canais, estranhas }
}
