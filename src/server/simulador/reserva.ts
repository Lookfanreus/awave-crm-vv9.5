






import 'server-only'
import { admin } from '@/server/supabase'
import { FRIO_MS } from '@/server/agente/orcamento'
import { requeueJob, type JobDaFila } from '@/server/agente/fila'
import { mensagemSegura } from '@/lib/sanitizar-erro'


export async function reservarJobDaConversa(ws: string, conversaId: string): Promise<JobDaFila[]> {
  const { data, error } = await admin().rpc('reservar_job_da_conversa', {
    p_ws: ws,
    p_conversa: conversaId,
    p_frio: `${FRIO_MS} milliseconds`,
  })
  if (error) throw new Error('falha ao reivindicar a rodada da simulacao')
  
  
  return ((data ?? []) as JobDaFila[]).filter((j) => typeof j.heartbeat_em === 'string')
}


export async function devolverReserva(job: JobDaFila): Promise<void> {
  try {
    await requeueJob(job, {})
  } catch (err) {
    console.warn('[simulador] reserva nao devolvida (nao-fatal):', mensagemSegura(err))
  }
}
