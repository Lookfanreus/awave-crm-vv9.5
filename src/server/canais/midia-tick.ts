











import 'server-only'
import { criarOrcamento, type Orcamento } from '@/lib/orcamento-tick'
import { admin } from '@/server/supabase'
import { refNaoValidada } from '@/server/canais/types'
import { baixarMidia, validarUrlDeMidia, TIMEOUT_MS } from '@/server/canais/midia'
import { getProvider } from '@/server/canais/registry'
import { lerCredenciais, type ResultadoCreds } from '@/server/canais/segredos'
import type { MidiaLinha } from '@/server/canais/leitura'


export const BUCKET = 'canais-midia'


export const TETO_POR_TICK = 5


export const TETO_TENTATIVAS = 3


export const RESERVA_MS = TETO_POR_TICK * TIMEOUT_MS * 3


export const COTA_BYTES = 500 * 1024 * 1024


export const COTA_DEPLOY_BYTES = 800 * 1024 * 1024


const VALIDADE_S = 60


const PAGINA = 1000

const PAGINAS_MAX = 10


const MIME_PADRAO: Record<MidiaLinha['kind'], string> = {
  imagem: 'image/jpeg',
  audio: 'audio/ogg',
  video: 'video/mp4',
  documento: 'application/pdf',
}


function umEmbed<T>(x: unknown): T | null {
  if (!x) return null
  return (Array.isArray(x) ? x[0] : x) as T
}

type LinhaPendente = {
  id: string
  workspace_id: string
  
  externo_id?: string | null
  midia: MidiaLinha | null
  conversas?: unknown
}


type CanalDoEmbed = {
  id?: string
  provider?: string
  external_id?: string | null
  config?: { server_url?: string }
}


type CacheDeCreds = Map<string, ResultadoCreds>


type Desfecho = { midia: MidiaLinha; tag: 'baixada' | 'falha' | 'adiada' | 'sem_cota' }


type Acervo = { porWorkspace: Map<string, number>; total: number }


function tipoDoConteudo(midia: MidiaLinha): string {
  const declarado = (midia.mime ?? '').split(';')[0].trim()
  return declarado || MIME_PADRAO[midia.kind] || 'application/octet-stream'
}


export async function bytesNoBucket(ws: string): Promise<number> {
  return (await medirBucket(ws)).bytes
}


export async function medirBucket(ws: string): Promise<{ bytes: number; medido: boolean }> {
  let total = 0
  for (let pagina = 0; pagina < PAGINAS_MAX; pagina++) {
    const { data } = await admin()
      .storage.from(BUCKET)
      .list(ws, { limit: PAGINA, offset: pagina * PAGINA })
    const objetos = data ?? []
    for (const o of objetos) total += o.metadata?.size ?? 0
    if (objetos.length < PAGINA) return { bytes: total, medido: true }
  }
  return { bytes: COTA_BYTES, medido: false }
}


async function prefixosDoBucket(): Promise<string[] | null> {
  const prefixos: string[] = []
  for (let pagina = 0; pagina < PAGINAS_MAX; pagina++) {
    const { data } = await admin()
      .storage.from(BUCKET)
      .list('', { limit: PAGINA, offset: pagina * PAGINA })
    const entradas = data ?? []
    for (const e of entradas) prefixos.push(e.name)
    if (entradas.length < PAGINA) return prefixos
  }
  return null
}


async function medirAcervo(): Promise<Acervo> {
  const prefixos = await prefixosDoBucket()
  
  
  if (prefixos === null) return { porWorkspace: new Map(), total: COTA_DEPLOY_BYTES }

  const porWorkspace = new Map<string, number>()
  let total = 0
  for (const p of prefixos) {
    const bytes = await bytesNoBucket(p)
    porWorkspace.set(p, bytes)
    total += bytes
  }
  return { porWorkspace, total }
}


async function credenciaisDoCanal(
  canal: CanalDoEmbed | null,
  serverUrl: string,
  cache: CacheDeCreds,
): Promise<ResultadoCreds | null> {
  const id = canal?.id
  if (!id || !canal?.provider) return null
  const guardado = cache.get(id)
  if (guardado) return guardado
  const r = await lerCredenciais({
    id,
    provider: canal.provider,
    serverUrl,
    externalId: canal.external_id ?? null,
  })
  cache.set(id, r)
  return r
}


async function processar(
  bruta: LinhaPendente,
  midia: MidiaLinha,
  acervo: Acervo,
  creds: CacheDeCreds,
): Promise<Desfecho> {
  
  
  const erro = (): Desfecho => ({ midia: { ...midia, status: 'erro' }, tag: 'falha' })

  
  const semCota = (): Desfecho => ({ midia, tag: 'sem_cota' })

  
  const adiar = (): Desfecho => {
    const tentativas = (midia.tentativas ?? 0) + 1
    if (tentativas >= TETO_TENTATIVAS) return erro()
    return { midia: { ...midia, tentativas }, tag: 'adiada' }
  }

  const conversa = umEmbed<{ canais?: unknown }>(bruta.conversas)
  const canal = umEmbed<CanalDoEmbed>(conversa?.canais)
  const serverUrl = canal?.config?.server_url
  
  
  if (!serverUrl) return erro()

  
  
  
  const cru = (midia as { refExterna?: unknown }).refExterna
  if (typeof cru !== 'string') return erro()

  
  
  
  
  const adapter = canal?.provider ? getProvider(canal.provider) : null
  let ref = refNaoValidada(cru)
  if (adapter?.resolverMidia) {
    const r = await credenciaisDoCanal(canal, serverUrl, creds)
    
    
    
    if (!r || r.creds === null) return adiar()
    const resolvida = await adapter.resolverMidia({ externoId: bruta.externo_id ?? null }, r.creds)
    
    
    if (!resolvida) return adiar()
    ref = resolvida
  }

  const url = validarUrlDeMidia(ref, serverUrl)
  
  
  if (!url) return erro()

  const ws = bruta.workspace_id
  const jaUsado = acervo.porWorkspace.get(ws) ?? 0
  
  if (jaUsado >= COTA_BYTES) return semCota()
  if (acervo.total >= COTA_DEPLOY_BYTES) return semCota()

  
  
  
  
  
  
  const folga = Math.min(COTA_BYTES - jaUsado, COTA_DEPLOY_BYTES - acervo.total)
  const r = await baixarMidia(url, serverUrl, {}, folga)
  if (!r.ok) {
    
    
    if (r.motivo === 'sem_cota') return semCota()
    
    
    if (r.motivo === 'destino_recusado' || r.motivo === 'grande') return erro()
    return adiar()
  }

  
  
  
  
  
  
  
  if (jaUsado + r.bytes.byteLength > COTA_BYTES) return semCota()
  if (acervo.total + r.bytes.byteLength > COTA_DEPLOY_BYTES) return semCota()

  
  
  
  const caminho = `${ws}/${bruta.id}`
  const { error } = await admin()
    .storage.from(BUCKET)
    .upload(caminho, r.bytes, { contentType: tipoDoConteudo(midia), upsert: true })
  if (error) return erro()

  acervo.porWorkspace.set(ws, jaUsado + r.bytes.byteLength)
  acervo.total += r.bytes.byteLength
  return { midia: { ...midia, status: 'ok', caminho }, tag: 'baixada' }
}


function semReserva(midia: MidiaLinha): MidiaLinha {
  if (midia.reservadaAte === undefined) return midia
  const { reservadaAte: _, ...resto } = midia
  return resto
}


async function soltarReserva(linhas: LinhaPendente[]): Promise<void> {
  for (const linha of linhas) {
    if (!linha.midia) continue
    const { error } = await admin()
      .from('mensagens')
      .update({ midia: semReserva(linha.midia) })
      .eq('workspace_id', linha.workspace_id)
      .eq('id', linha.id)
    if (error) console.warn('[canais/midia] reserva nao devolvida a fila')
  }
}


export async function drenarMidia(
  orcamento: Orcamento = criarOrcamento(Date.now()),
): Promise<{
  baixadas: number
  falhas: number
  adiadas: number
  semCota: number
}> {
  
  
  
  
  
  
  
  
  
  
  
  if (!orcamento.cabe('midia')) return { baixadas: 0, falhas: 0, adiadas: 0, semCota: 0 }

  const { data: reservadas, error: erroReserva } = await admin().rpc('reservar_midias', {
    p_limite: TETO_POR_TICK,
    p_reserva: `${RESERVA_MS} milliseconds`,
  })
  if (erroReserva) throw erroReserva

  
  
  
  const ids = ((reservadas ?? []) as Array<{ id: string }>).map((l) => l.id)
  
  
  if (ids.length === 0) return { baixadas: 0, falhas: 0, adiadas: 0, semCota: 0 }

  
  
  
  
  
  const { data, error } = await admin()
    .from('mensagens')
    .select('id, workspace_id, externo_id, midia, conversa_id, conversas!inner(canal_id, canais!inner(id, provider, external_id, config))')
    .in('id', ids)
    .order('criado_em', { ascending: true })
  
  
  if (error) throw error

  let baixadas = 0
  let falhas = 0
  let adiadas = 0
  let semCota = 0
  
  const acervo = await medirAcervo()
  
  const credsDoTick: CacheDeCreds = new Map()

  const pendentes = (data ?? []) as LinhaPendente[]
  for (let i = 0; i < pendentes.length; i++) {
    const bruta = pendentes[i]
    const midia = bruta.midia
    if (!midia) continue

    
    
    
    
    if (!orcamento.cabe('midia')) {
      const restantes = pendentes.slice(i)
      await soltarReserva(restantes)
      
      
      
      
      adiadas += restantes.filter((l) => l.midia).length
      break
    }

    let d: Desfecho
    try {
      d = await processar(bruta, midia, acervo, credsDoTick)
    } catch {
      
      
      d = { midia: { ...midia, status: 'erro' }, tag: 'falha' }
    }

    if (d.tag === 'baixada') baixadas++
    else if (d.tag === 'adiada') adiadas++
    else if (d.tag === 'sem_cota') semCota++
    else falhas++

    
    
    
    
    
    
    
    const persistir = d.tag === 'baixada' || d.tag === 'falha' ? semReserva(d.midia) : d.midia
    await admin()
      .from('mensagens')
      .update({ midia: persistir })
      .eq('workspace_id', bruta.workspace_id)
      .eq('id', bruta.id)
  }

  return { baixadas, falhas, adiadas, semCota }
}


export async function assinarMidias(
  workspaceId: string,
  linhas: { id: string; midia: MidiaLinha | null }[],
): Promise<Map<string, string>> {
  const alvos: Array<{ id: string; caminho: string }> = []
  for (const l of linhas) {
    const caminho = l.midia?.status === 'ok' ? l.midia.caminho : undefined
    
    if (caminho && caminho.startsWith(`${workspaceId}/`)) alvos.push({ id: l.id, caminho })
  }
  if (alvos.length === 0) return new Map()

  const { data, error } = await admin()
    .storage.from(BUCKET)
    .createSignedUrls(
      alvos.map((a) => a.caminho),
      VALIDADE_S,
    )
  
  
  if (error) return new Map()

  
  
  
  const porCaminho = new Map((data ?? []).map((d) => [d.path ?? '', d.signedUrl]))
  const saida = new Map<string, string>()
  for (const a of alvos) {
    const url = porCaminho.get(a.caminho)
    if (url) saida.set(a.id, url)
  }
  return saida
}
