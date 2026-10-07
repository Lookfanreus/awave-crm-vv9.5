



import 'server-only'
import { admin } from '@/server/supabase'
import { FRIO_MS, JOBS_POR_TICK } from '@/server/agente/orcamento'


export class FalhaDoDreno extends Error {}

export type JobDaFila = {
  id: string
  workspace_id: string
  conversa_id: string
  status: string
  
  nao_antes: string
  
  heartbeat_em: string
  tentativas: number
  max_tentativas: number
  descartes: number
  
  rodadas_pagas: number
}


export async function reivindicarJobs(limite: number = JOBS_POR_TICK): Promise<JobDaFila[]> {
  const { data, error } = await admin().rpc('reservar_jobs', {
    p_limite: limite,
    p_frio: `${FRIO_MS} milliseconds`,
  })
  if (error) throw new FalhaDoDreno('falha ao reivindicar as rodadas do agente')
  return ((data ?? []) as JobDaFila[]).filter((j) => typeof j.heartbeat_em === 'string')
}


async function escrever(
  job: JobDaFila,
  dados: Record<string, unknown>,
  exigirRelogioIntacto = false,
): Promise<boolean> {
  
  
  const base = admin()
    .from('atendimento_jobs')
    .update(dados)
    .eq('workspace_id', job.workspace_id)
    .eq('id', job.id)
    .eq('status', 'running')
    .eq('heartbeat_em', job.heartbeat_em)
  const { data, error } = await (exigirRelogioIntacto ? base.eq('nao_antes', job.nao_antes) : base).select('id')
  if (error) throw new FalhaDoDreno('falha ao escrever na fila do agente')
  return ((data ?? []) as unknown[]).length === 1
}


export async function concluirSeIntacto(job: JobDaFila): Promise<boolean> {
  return escrever(job, { status: 'done' }, true)
}


export async function requeueJob(
  job: JobDaFila,
  patch: { tentativas?: number; descartes?: number; ultimoErro?: string | null; naoAntes?: string },
): Promise<boolean> {
  const dados: Record<string, unknown> = { status: 'queued' }
  if (patch.tentativas !== undefined) dados.tentativas = patch.tentativas
  if (patch.descartes !== undefined) dados.descartes = patch.descartes
  if (patch.ultimoErro !== undefined) dados.ultimo_erro = patch.ultimoErro
  if (patch.naoAntes !== undefined) dados.nao_antes = patch.naoAntes
  return escrever(job, dados)
}


export async function matarJob(job: JobDaFila, ultimoErro: string): Promise<boolean> {
  return escrever(job, { status: 'dead', ultimo_erro: ultimoErro })
}


export async function marcarRodadaPaga(job: JobDaFila): Promise<boolean> {
  return escrever(job, { rodadas_pagas: job.rodadas_pagas + 1 })
}


export function esgotou(job: JobDaFila): boolean {
  return job.tentativas >= job.max_tentativas
}
