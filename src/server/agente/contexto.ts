





import 'server-only'
import { admin } from '@/server/supabase'
import { IDADE_MAXIMA_JOB_MS } from '@/server/agente/orcamento'
import type { Estouro } from '@/server/agente/tetos'
import type { JobDaFila } from '@/server/agente/fila'
import { devolveuDepois, escalouDepois, pediuHumanoNoLote } from '@/lib/canais/humano'
import {
  TETO_MENSAGENS_THREAD,
  temTextoParaOModelo,
  type MensagemDoPrompt,
} from '@/lib/canais/historico-agente'

export type MotivoDeNaoRodar =
  | 'sem_conversa'
  | 'sem_canal'
  | 'workspace_divergente'
  | 'agente_desligado'
  | 'humano_com_a_conversa'
  | 'job_velho'
  | 'fora_da_janela'
  | 'teto_conversa'
  | 'teto_workspace'
  | 'teto_deploy'
  | 'pediu_humano'
  | 'ninguem_perguntou'

export type DecisaoDeRodada = { rodar: true } | { rodar: false; motivo: MotivoDeNaoRodar }

export type ConversaDoTurno = {
  workspace_id: string
  status: string
  
  atribuida_a: string | null
  ultima_msg_in_at: string | null
  escalada_em: string | null
  
  devolvida_em: string | null
  contato_id: string | null
  canal_id: string
}

export type CanalDoTurno = {
  workspace_id: string
  agente_ligado: boolean
  
  agente_id?: string | null
  
  provider?: string | null
}

export interface EstadoDoTurno {
  jobWorkspaceId: string
  
  naoAntesMs: number
  agoraMs: number
  conversa: ConversaDoTurno | null
  canal: CanalDoTurno | null
  estouro: Estouro
  
  mensagens: MensagemDoPrompt[]
}


export const JANELA_MS = 24 * 60 * 60 * 1000


function chegouAoCliente(m: MensagemDoPrompt): boolean {
  return m.direcao === 'saida' && m.status !== 'descartada' && m.status !== 'falhou'
}


export function falasDoLote(msgs: MensagemDoPrompt[]): string[] {
  const lote: string[] = []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (chegouAoCliente(m)) break
    if (m.direcao === 'entrada' && temTextoParaOModelo(m.texto)) lote.unshift(m.texto)
  }
  return lote
}

export function decidirRodada(e: EstadoDoTurno): DecisaoDeRodada {
  const naoRoda = (motivo: MotivoDeNaoRodar): DecisaoDeRodada => ({ rodar: false, motivo })

  if (!e.conversa) return naoRoda('sem_conversa')
  if (!e.canal) return naoRoda('sem_canal')

  
  
  
  
  if (e.jobWorkspaceId !== e.conversa.workspace_id) return naoRoda('workspace_divergente')
  if (e.jobWorkspaceId !== e.canal.workspace_id) return naoRoda('workspace_divergente')

  
  
  if (!e.canal.agente_ligado) return naoRoda('agente_desligado')

  
  
  
  
  
  
  
  
  
  
  if (e.conversa.status !== 'aberta' || e.conversa.atribuida_a) {
    return naoRoda('humano_com_a_conversa')
  }

  
  
  
  if (e.agoraMs - e.naoAntesMs > IDADE_MAXIMA_JOB_MS) return naoRoda('job_velho')

  const entrou = e.conversa.ultima_msg_in_at ? Date.parse(e.conversa.ultima_msg_in_at) : Number.NaN
  if (!Number.isFinite(entrou) || e.agoraMs - entrou > JANELA_MS) return naoRoda('fora_da_janela')

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const lote = falasDoLote(e.mensagens)
  const jaEscalou = escalouDepois(e.conversa.escalada_em, e.conversa.ultima_msg_in_at)
  const pessoaJaDecidiu = devolveuDepois(e.conversa.devolvida_em, e.conversa.ultima_msg_in_at)
  if (!jaEscalou && !pessoaJaDecidiu && pediuHumanoNoLote(lote)) return naoRoda('pediu_humano')

  if (e.estouro === 'conversa') return naoRoda('teto_conversa')
  if (e.estouro === 'workspace') return naoRoda('teto_workspace')
  if (e.estouro === 'deploy') return naoRoda('teto_deploy')

  
  
  
  if (lote.length === 0) return naoRoda('ninguem_perguntou')

  return { rodar: true }
}


const PERSONA_VAZIA = { nome: '', tratamento: 'voce' as const, sobreONegocio: '' }



export async function carregarContexto(
  job: JobDaFila,
  assistenteEscolhido?: string | null,
): Promise<{
  conversa: ConversaDoTurno | null
  canal: CanalDoTurno | null
  mensagens: MensagemDoPrompt[]
  persona: { nome: string; tratamento: 'voce' | 'senhor'; sobreONegocio: string }
  
  assistenteId: string | null
}> {
  const db = admin()

  const { data: conversaBruta, error: erroConversa } = await db
    .from('conversas')
    
    
    
    .select(
      'workspace_id, status, atribuida_a, ultima_msg_in_at, escalada_em, devolvida_em, contato_id, canal_id',
    )
    .eq('workspace_id', job.workspace_id)
    .eq('id', job.conversa_id)
    .maybeSingle()
  
  
  
  
  
  
  
  
  
  
  if (erroConversa) throw new Error('falha ao ler a conversa do turno')
  const conversa = (conversaBruta as ConversaDoTurno | null) ?? null
  if (!conversa) {
    return { conversa: null, canal: null, mensagens: [], persona: PERSONA_VAZIA, assistenteId: null }
  }

  const { data: canalBruto, error: erroCanal } = await db
    .from('canais')
    
    
    
    
    
    
    
    .select('workspace_id, agente_ligado, agente_id, provider')
    .eq('workspace_id', job.workspace_id)
    .eq('id', conversa.canal_id)
    .maybeSingle()
  if (erroCanal) throw new Error('falha ao ler o canal do turno')

  
  
  const { data: msgs, error: erroMsgs } = await db
    .from('mensagens')
    .select('direcao, autor, texto, status')
    .eq('workspace_id', job.workspace_id)
    .eq('conversa_id', job.conversa_id)
    .order('origem_em', { ascending: false })
    .limit(TETO_MENSAGENS_THREAD)
  
  
  if (erroMsgs) throw new Error('falha ao ler as mensagens do turno')

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const agenteDoCanal =
    assistenteEscolhido || (canalBruto as CanalDoTurno | null)?.agente_id || null
  
  
  
  const { data: personaBruta, error: erroPersona } = await db
    .from('assistentes')
    .select('id, nome, tratamento, sobre_o_negocio')
    .eq('workspace_id', job.workspace_id)
    .eq(agenteDoCanal ? 'id' : 'padrao', agenteDoCanal ?? true)
    .maybeSingle()
  
  
  
  
  
  if (erroPersona) throw new Error('falha ao ler a persona do turno')

  const p = personaBruta as
    | { id?: string | null; nome?: string; tratamento?: string; sobre_o_negocio?: string }
    | null

  return {
    conversa,
    canal: (canalBruto as CanalDoTurno | null) ?? null,
    
    
    mensagens: ((msgs ?? []) as MensagemDoPrompt[]).slice().reverse(),
    persona: p
      ? {
          nome: p.nome ?? '',
          tratamento: p.tratamento === 'senhor' ? 'senhor' : 'voce',
          sobreONegocio: p.sobre_o_negocio ?? '',
        }
      : PERSONA_VAZIA,
    
    
    assistenteId: p?.id ?? null,
  }
}
