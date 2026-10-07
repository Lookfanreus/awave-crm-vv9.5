import 'server-only'
import { getSecret } from '@/server/secrets'
import { gravarConfig } from '@/server/configuracoes'
import { mensagemSegura, detalheSeguro } from '@/lib/sanitizar-erro'
import type { ResultadoGatilho } from '@/lib/estado-atualizacao'




const TIMEOUT_MS = 5000


export const SEGREDO_GATILHO = 'easypanel_deploy_webhook'


export const CHAVE_GATILHO = 'update_deploy_trigger'

export type ResultadoDisparo = {
  
  ok: boolean
  
  detalhe: string
}


function motivoDeRede(erro: unknown): string {
  const codigo = (erro as { cause?: { code?: unknown } })?.cause?.code
  const base = mensagemSegura(erro)
  return typeof codigo === 'string' && codigo ? `${base} (${codigo})` : base
}


export async function dispararGatilho(
  url: string,
  buscar: typeof fetch = fetch,
): Promise<ResultadoDisparo> {
  const bater = (metodo: 'POST' | 'GET') =>
    buscar(url, {
      method: metodo,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

  try {
    const post = await bater('POST')
    if (post.ok) return { ok: true, detalhe: `HTTP ${post.status}` }

    const get = await bater('GET')
    return get.ok
      ? { ok: true, detalhe: `HTTP ${get.status} (GET)` }
      : { ok: false, detalhe: `HTTP ${post.status} (POST) / ${get.status} (GET)` }
  } catch (erro) {
    return { ok: false, detalhe: motivoDeRede(erro) }
  }
}


export async function avisarOPainel(
  agoraIso: () => string = () => new Date().toISOString(),
  buscar: typeof fetch = fetch,
): Promise<ResultadoGatilho> {
  let resultado: ResultadoGatilho = { tipo: 'ausente', em: agoraIso() }
  try {
    const url = (await getSecret(SEGREDO_GATILHO))?.trim()
    if (url) {
      const r = await dispararGatilho(url, buscar)
      resultado = r.ok
        ? { tipo: 'disparado', em: agoraIso() }
        : { tipo: 'falhou', detalhe: r.detalhe, em: agoraIso() }
      if (!r.ok) console.warn('[atualizacao] gatilho de deploy falhou (não-fatal):', r.detalhe)
    }
    await gravarConfig(CHAVE_GATILHO, JSON.stringify(resultado))
  } catch (erro) {
    
    console.warn('[atualizacao] não consegui registrar o gatilho:', detalheSeguro(erro))
  }
  return resultado
}
