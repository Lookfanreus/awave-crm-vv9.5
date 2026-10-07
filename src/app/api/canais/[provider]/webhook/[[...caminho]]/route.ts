














import {
  conferirAssinatura,
  getProvider,
  resolverCanaisDoEnvelope,
  verificarEvento,
  verificarRequest,
} from '@/server/canais/registry'
import type { CanalRow } from '@/server/canais/registry'
import { readBodyCapped } from '@/server/http/readBodyCapped'
import { despachar } from '@/server/canais/dispatch'
import { filtrarPorOrigem } from '@/server/canais/origem-de-taxa'
import { BALDE_CANAL, BALDE_ORIGEM, consumir, type EstadoBalde } from '@/lib/canais/rateLimit'
import { chaveVerifyToken } from '@/server/canais/segredos'
import { getSecret } from '@/server/secrets'
import { iguaisTimingSafe } from '@/server/http/timing-safe'
import { detalheSeguro } from '@/lib/sanitizar-erro'
import type { CanalEvent, CorteDoEnvelope } from '@/server/canais/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'



const BALDES_CANAL = new Map<string, EstadoBalde>()
const BALDES_ORIGEM = new Map<string, EstadoBalde>()














const BALDES_REJEICAO = new Map<string, EstadoBalde>()


function registrarDescarte(canalId: string, motivo: string, quantos: number): void {
  console.warn(`[canais/webhook] descartado no ${motivo}: ${quantos} · canal ${canalId}`)
}












const TETO_CHALLENGE = 512

const CHALLENGE_OK = /^[A-Za-z0-9_-]+$/


export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string; caminho?: string[] }> },
): Promise<Response> {
  const { provider, caminho = [] } = await ctx.params

  
  
  const v = await verificarRequest({ provider, segmentos: caminho })
  if (!v.ok) return new Response(null, { status: v.status })

  const parametros = new URL(req.url).searchParams

  
  
  if (parametros.get('hub.mode') !== 'subscribe') return new Response(null, { status: 401 })

  
  
  
  const esperado = await getSecret(chaveVerifyToken(v.canal.id))
  if (!esperado) return new Response(null, { status: 503 })

  
  
  if (!iguaisTimingSafe(parametros.get('hub.verify_token') ?? '', esperado)) {
    return new Response(null, { status: 401 })
  }

  
  
  const challenge = parametros.get('hub.challenge') ?? ''
  if (challenge.length > TETO_CHALLENGE || !CHALLENGE_OK.test(challenge)) {
    return new Response(null, { status: 400 })
  }

  return new Response(challenge, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string; caminho?: string[] }> },
): Promise<Response> {
  const { provider, caminho = [] } = await ctx.params

  
  const corpo = await readBodyCapped(req)
  if (!corpo.ok) return new Response(null, { status: 413 })

  
  const v = await verificarRequest({ provider, segmentos: caminho })
  if (!v.ok) return new Response(null, { status: v.status })

  
  
  
  
  
  
  
  
  const adapter = getProvider(provider)
  if (!adapter) return new Response(null, { status: 404 })

  const agora = Date.now()

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const cabecalhos = Object.fromEntries(req.headers)
  const assinatura = await conferirAssinatura(v.canal, adapter, corpo, cabecalhos)

  
  
  
  if (assinatura === 'indisponivel') return new Response(null, { status: 503 })

  if (assinatura === 'recusado') {
    
    
    
    if (consumir(BALDES_REJEICAO, BALDE_CANAL, v.canal.id, agora)) {
      await despachar.registrarRejeicaoDeAssinatura(v.canal)
    }
    return new Response(null, { status: 401 })
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (!consumir(BALDES_CANAL, BALDE_CANAL, v.canal.id, agora)) {
    return new Response(null, { status: 429, headers: { 'retry-after': '1' } })
  }

  let envelope: unknown
  try {
    envelope = JSON.parse(corpo.raw)
  } catch {
    
    return Response.json({ ok: true })
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  let lotes: Array<{ canal: CanalRow; eventos: CanalEvent[] }>

  
  
  
  
  
  
  
  
  
  
  
  
  
  const corte: CorteDoEnvelope = { descartados: 0 }

  if (!adapter.identidadesDaInstancia) {
    const veredicto = await verificarEvento(v.canal, envelope)

    
    
    
    
    if (veredicto.veredito === 'indisponivel') return new Response(null, { status: 503 })

    if (veredicto.veredito === 'recusado') {
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      console.warn(`[canais] evento recusado — canal ${v.canal.id}: ${veredicto.motivo}`)
      await despachar.registrarRejeicao(v.canal)
      return Response.json({ ok: true })
    }
    lotes = [{ canal: v.canal, eventos: adapter.parse(envelope, undefined, corte) }]
  } else {
    const resolucao = await resolverCanaisDoEnvelope(
      v.canal,
      envelope,
      adapter,
      corpo,
      cabecalhos,
      
      
    )

    
    
    
    if (resolucao.veredicto === 'indisponivel') return new Response(null, { status: 503 })

    if (resolucao.veredicto === 'recusado') {
      
      
      
      
      
      await despachar.registrarRejeicao(v.canal)
      return Response.json({ ok: true })
    }

    if (resolucao.veredicto === 'sem_identidade') {
      
      
      
      
      
      
      
      
      
      
      return Response.json({ ok: true })
    }

    
    
    
    
    if (resolucao.estranhas > 0) await despachar.registrarRejeicao(v.canal)

    
    
    
    
    
    const porIdentidade = adapter.eventosPorIdentidade
    if (!porIdentidade) return new Response(null, { status: 503 })

    lotes = []
    for (const grupo of porIdentidade(envelope, undefined, corte)) {
      const alvo = resolucao.canais.get(grupo.identidade)
      
      
      if (alvo) lotes.push({ canal: alvo, eventos: grupo.eventos })
    }
  }

  if (corte.descartados > 0) registrarDescarte(v.canal.id, 'teto do envelope', corte.descartados)

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  for (const lote of lotes) {
    const { aceitos, descartados } = filtrarPorOrigem(lote.eventos, (chave) =>
      consumir(BALDES_ORIGEM, BALDE_ORIGEM, `${lote.canal.id}:${chave}`, agora),
    )
    
    
    
    if (descartados > 0) registrarDescarte(lote.canal.id, 'balde da origem', descartados)

    try {
      
      
      
      
      
      
      
      
      
      await despachar(lote.canal, aceitos, adapter.capabilities.identidadePorTelefone)
    } catch (err) {
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      console.error('[canais/webhook] falha ao despachar:', detalheSeguro(err))
      return new Response(null, { status: 500 })
    }
  }

  return Response.json({ ok: true })
}
