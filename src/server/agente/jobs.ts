




import 'server-only'
import { admin } from '@/server/supabase'
import { DEBOUNCE_MS, PAUSA_APARELHO_MS } from '@/server/agente/orcamento'


export class FalhaDaFila extends Error {}

export type EstadoDaConversa = {
  status: string
  atribuidaA: string | null
  assumidaEm: string | null
}

export type Agendamento =
  | { acao: 'agendar' }
  | { acao: 'agendar_e_despausar' }
  | {
      acao: 'ignorar'
      motivo: 'sem_conversa' | 'assumida' | 'aguardando_humano' | 'arquivada' | 'pausa_do_aparelho' | 'status_desconhecido'
    }


export function decidirAgendamento(estado: EstadoDaConversa | null, agoraMs: number): Agendamento {
  if (!estado) return { acao: 'ignorar', motivo: 'sem_conversa' }
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (estado.status === 'aberta') {
    return estado.atribuidaA ? { acao: 'ignorar', motivo: 'assumida' } : { acao: 'agendar' }
  }
  if (estado.status === 'arquivada') return { acao: 'ignorar', motivo: 'arquivada' }
  if (estado.status === 'aguardando_humano') return { acao: 'ignorar', motivo: 'aguardando_humano' }
  if (estado.status !== 'assumida') return { acao: 'ignorar', motivo: 'status_desconhecido' }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (estado.atribuidaA) return { acao: 'ignorar', motivo: 'assumida' }

  const desde = Date.parse(estado.assumidaEm ?? '')
  
  
  
  if (!Number.isFinite(desde)) return { acao: 'ignorar', motivo: 'pausa_do_aparelho' }
  if (agoraMs - desde < PAUSA_APARELHO_MS) return { acao: 'ignorar', motivo: 'pausa_do_aparelho' }
  return { acao: 'agendar_e_despausar' }
}

async function lerEstado(ws: string, conversaId: string): Promise<EstadoDaConversa | null> {
  const { data, error } = await admin()
    .from('conversas')
    .select('status, atribuida_a, assumida_em')
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .maybeSingle()
  
  
  
  if (error) throw new FalhaDaFila('falha ao ler a conversa da fila do agente')
  if (!data) return null
  const linha = data as { status: string; atribuida_a: string | null; assumida_em: string | null }
  return {
    status: linha.status,
    atribuidaA: linha.atribuida_a ?? null,
    assumidaEm: linha.assumida_em ?? null,
  }
}


async function despausar(ws: string, conversaId: string): Promise<void> {
  const { error } = await admin()
    .from('conversas')
    .update({ status: 'aberta', assumida_em: null })
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .eq('status', 'assumida')
    .is('atribuida_a', null)
  if (error) throw new FalhaDaFila('falha ao encerrar a pausa do aparelho')
}


const naoAntesDe = (agoraMs: number): string => new Date(agoraMs + DEBOUNCE_MS).toISOString()

function ehDuplicata(erro: { code?: string } | null | undefined): boolean {
  return erro?.code === '23505'
}


export async function agendarJob(
  ws: string,
  conversaId: string,
  agoraMs: number,
): Promise<'criado' | 'empurrado' | 'ignorado'> {
  return tentarAgendar(ws, conversaId, agoraMs, 2)
}

async function tentarAgendar(
  ws: string,
  conversaId: string,
  agoraMs: number,
  restantes: number,
): Promise<'criado' | 'empurrado' | 'ignorado'> {
  const decisao = decidirAgendamento(await lerEstado(ws, conversaId), agoraMs)
  if (decisao.acao === 'ignorar') return 'ignorado'
  if (decisao.acao === 'agendar_e_despausar') await despausar(ws, conversaId)

  const naoAntes = naoAntesDe(agoraMs)
  const { error } = await admin()
    .from('atendimento_jobs')
    .insert({ workspace_id: ws, conversa_id: conversaId, nao_antes: naoAntes })
  if (!error) return 'criado'
  if (!ehDuplicata(error)) throw new FalhaDaFila('falha ao agendar a rodada do agente')

  
  const { data, error: erroEmpurrao } = await admin()
    .from('atendimento_jobs')
    .update({ nao_antes: naoAntes })
    .eq('workspace_id', ws)
    .eq('conversa_id', conversaId)
    .in('status', ['queued', 'running'])
    .select('id')
  if (erroEmpurrao) throw new FalhaDaFila('falha ao empurrar a rodada do agente')

  
  
  
  
  
  
  
  if ((data ?? []).length === 0) {
    if (restantes <= 0) throw new FalhaDaFila('a rodada do agente nao ficou agendada')
    return tentarAgendar(ws, conversaId, agoraMs, restantes - 1)
  }
  return 'empurrado'
}


export async function garantirJob(
  ws: string,
  conversaId: string,
  agoraMs: number,
): Promise<'criado' | 'ja_existia' | 'ignorado'> {
  const decisao = decidirAgendamento(await lerEstado(ws, conversaId), agoraMs)
  if (decisao.acao === 'ignorar') return 'ignorado'
  if (decisao.acao === 'agendar_e_despausar') await despausar(ws, conversaId)

  const { error } = await admin()
    .from('atendimento_jobs')
    .insert({ workspace_id: ws, conversa_id: conversaId, nao_antes: naoAntesDe(agoraMs) })
  if (!error) return 'criado'
  if (ehDuplicata(error)) return 'ja_existia'
  throw new FalhaDaFila('falha ao garantir a rodada do agente')
}


export async function encerrarPausaDoAparelho(
  ws: string,
  conversaId: string,
  agoraMs: number,
): Promise<'encerrada' | 'nao_havia'> {
  const decisao = decidirAgendamento(await lerEstado(ws, conversaId), agoraMs)
  if (decisao.acao !== 'agendar_e_despausar') return 'nao_havia'
  await despausar(ws, conversaId)
  return 'encerrada'
}


export async function pausarPorAparelho(ws: string, conversaId: string, agoraIso: string): Promise<void> {
  const { error } = await admin()
    .from('conversas')
    .update({ status: 'assumida', assumida_em: agoraIso })
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .in('status', ['aberta', 'assumida'])
    .is('atribuida_a', null)
  if (error) throw new FalhaDaFila('falha ao pausar o agente pelo aparelho')
}
