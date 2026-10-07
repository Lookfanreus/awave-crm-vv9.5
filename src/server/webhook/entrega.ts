import 'server-only'
import { criarOrcamento, type Orcamento } from '@/lib/orcamento-tick'
import { admin } from '@/server/supabase'
import { getSecret } from '@/server/secrets'
import { mensagemSegura } from '@/lib/sanitizar-erro'
import { backoff, montarPayload, assinar, type LinhaOutbox } from '@/server/webhook/nucleo'

const LIMITE_POR_TICK = 20
const MAX_TENTATIVAS = 8
const IDADE_MAX_MS = 7 * 24 * 60 * 60 * 1000 
const TIMEOUT_MS = 8000

type LinhaCompleta = LinhaOutbox & { tentativas: number; entregue_em: string | null }


export async function entregarPendentes(
  orcamento: Orcamento = criarOrcamento(Date.now()),
): Promise<{ entregues: number; falhas: number; pulados: number }> {
  
  
  
  
  if (!orcamento.cabe('entrega')) return { entregues: 0, falhas: 0, pulados: 0 }

  const cli = admin()
  const { data, error } = await cli.rpc('reservar_eventos', { p_limite: LIMITE_POR_TICK })
  if (error) throw error
  const linhas = (data ?? []) as LinhaCompleta[]

  let entregues = 0, falhas = 0, pulados = 0
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    
    
    
    
    if (!orcamento.cabe('entrega')) {
      await soltarReserva(cli, linhas.slice(i))
      pulados += linhas.length - i
      break
    }
    
    const { data: cfg } = await cli.from('webhook_config')
      .select('endpoint_url, ativo').eq('workspace_id', linha.workspace_id).maybeSingle()
    const conf = cfg as { endpoint_url: string; ativo: boolean } | null
    if (!conf || !conf.ativo) {
      
      if (Date.now() - new Date(linha.criado_em).getTime() > IDADE_MAX_MS) {
        await cli.from('eventos_webhook').update({ desistido_em: new Date().toISOString(), ultimo_erro: 'sem_config' }).eq('id', linha.id)
      }
      pulados++; continue
    }
    const segredo = await getSecret('webhook_secret:' + linha.workspace_id)
    if (!segredo) { pulados++; continue }

    const raw = JSON.stringify(montarPayload(linha))
    const sig = assinar(raw, segredo)
    try {
      const resp = await fetch(conf.endpoint_url, {
        method: 'POST', body: raw,
        headers: { 'content-type': 'application/json', 'x-awave-signature': sig, 'x-awave-evento-id': linha.id },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (resp.ok) {
        await cli.from('eventos_webhook').update({ entregue_em: new Date().toISOString() }).eq('id', linha.id)
        entregues++
      } else {
        await falhar(cli, linha, `http_${resp.status}`)
        falhas++
      }
    } catch (err) {
      
      
      
      
      
      
      
      
      
      
      await falhar(cli, linha, mensagemSegura(err) || 'erro_desconhecido')
      falhas++
    }
  }
  return { entregues, falhas, pulados }
}


async function soltarReserva(cli: ReturnType<typeof admin>, linhas: LinhaCompleta[]) {
  const agora = new Date().toISOString()
  for (const linha of linhas) {
    const { error } = await cli
      .from('eventos_webhook')
      .update({ proxima_tentativa: agora })
      .eq('id', linha.id)
    if (error) console.warn('[webhook/entrega] reserva nao devolvida a fila')
  }
}

async function falhar(cli: ReturnType<typeof admin>, linha: LinhaCompleta, motivo: string) {
  const tentativas = linha.tentativas + 1
  const patch: Record<string, unknown> = {
    tentativas, ultimo_erro: motivo,
    proxima_tentativa: new Date(Date.now() + backoff(tentativas)).toISOString(),
  }
  if (tentativas >= MAX_TENTATIVAS) patch.desistido_em = new Date().toISOString()
  await cli.from('eventos_webhook').update(patch).eq('id', linha.id)
}
