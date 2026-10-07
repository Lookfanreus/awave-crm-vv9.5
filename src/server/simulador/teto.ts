











import 'server-only'
import { admin } from '@/server/supabase'
import { JANELA_SIMULACAO_MS, TETO_SIMULACOES_HORA } from '@/lib/canais/simulacao'

export type ResultadoDoTeto = { ok: true } | { erro: 'teto' }


export const RECUSADA_PELO_TETO = 'rodada de teste encerrada pelo teto de simulacao'


function inicioDaJanela(): string {
  return new Date(Date.now() - JANELA_SIMULACAO_MS).toISOString()
}


async function encerrarRodadaRecusada(ws: string, conversaId: string): Promise<void> {
  const { error } = await admin()
    .from('atendimento_jobs')
    .update({ status: 'done', ultimo_erro: RECUSADA_PELO_TETO })
    .eq('workspace_id', ws)
    .eq('conversa_id', conversaId)
    .eq('status', 'queued')
  if (error) throw new Error('falha ao encerrar a rodada de teste recusada')
}


export async function registrarRodadaDeSimulacao(
  ws: string,
  canalId: string,
  conversaId: string,
): Promise<ResultadoDoTeto> {
  const { count, error } = await admin()
    .from('atendimento_jobs')
    .select('id, conversas!inner(canal_id)', { count: 'exact', head: true })
    .eq('workspace_id', ws)
    .eq('conversas.canal_id', canalId)
    .gte('criado_em', inicioDaJanela())
  
  
  
  
  if (error) throw new Error('falha ao contar as simulacoes da hora')

  if ((count ?? 0) <= TETO_SIMULACOES_HORA) return { ok: true }
  await encerrarRodadaRecusada(ws, conversaId)
  return { erro: 'teto' }
}


export async function podeRecomecarSimulacao(ws: string, canalId: string): Promise<ResultadoDoTeto> {
  const { count, error } = await admin()
    .from('conversas')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ws)
    .eq('canal_id', canalId)
    .gte('criado_em', inicioDaJanela())
  
  if (error) throw new Error('falha ao contar as simulacoes da hora')
  return (count ?? 0) > TETO_SIMULACOES_HORA ? { erro: 'teto' } : { ok: true }
}
