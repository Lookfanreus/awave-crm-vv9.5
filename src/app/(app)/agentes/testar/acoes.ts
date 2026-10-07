'use server'

import { exigirEngineLiberado } from '@/server/license/exigir'
import { ehOwnerDoWorkspace } from '@/server/auth/owner-workspace'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { despachar } from '@/server/canais/dispatch'
import { simuladorAdapter } from '@/server/canais/providers/simulador'
import { atenderUmJob } from '@/server/agente/runtime'
import { acumuladoVazio, estourou, lerRodadas } from '@/server/agente/tetos'





import { CHAVE_OPENAI } from '@/server/agente/chaves'
import { getSecret } from '@/server/secrets'
import {
  conversaDeSimulacao,
  ehConversaDeSimulacao,
  eventoDeSimulacao,
  garantirCanalDeSimulacao,
  recomecarSimulacao,
  statusDaConversaDeSimulacao,
} from '@/server/simulador/canal'
import { podeRecomecarSimulacao, registrarRodadaDeSimulacao } from '@/server/simulador/teto'
import { devolverReserva, reservarJobDaConversa } from '@/server/simulador/reserva'
import { TETO_TEXTO_SIMULADO } from '@/lib/canais/simulacao'
import { mensagemSegura } from '@/lib/sanitizar-erro'
import type { MotivoDeNaoRodar } from '@/server/agente/contexto'



export type ResultadoSimples = { ok: true } | { erro: string }


export type MotivoDaSimulacao = MotivoDeNaoRodar | 'teto_simulacao' | 'sem_chave' | 'nao_rodou'

export type ResultadoDaSimulacao = { ok: true; motivo?: MotivoDaSimulacao } | { erro: string }

const SEM_WS = 'Você não está em nenhum espaço de trabalho.'
const SO_O_OWNER = 'Só quem administra este espaço de trabalho pode testar o assistente.'
const TEXTO_VAZIO = 'Escreva uma mensagem para testar.'
const TEXTO_LONGO = 'Mensagem longa demais para um teste.'

const NAO_E_SIMULACAO = 'Esta conversa não é do canal de teste.'

const TETO_DO_LIMPAR =
  'Você já começou muitas conversas de teste nesta hora. Espere um pouco para começar outra — o limite existe para o teste não encher o banco de quem instalou.'
const ROTA = '/agentes/testar'

async function wsDaSessao(): Promise<string | null> {
  const cliente = await criarClienteServidor()
  return resolverWorkspaceAtivo({ cliente })
}


async function revalidarTela(): Promise<void> {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath(ROTA)
  } catch (err) {
    console.warn('[simulador] revalidatePath falhou (não-fatal):', mensagemSegura(err))
  }
}


async function motivoDoSilencio(
  ws: string,
  conversaId: string,
  canalLigado: boolean,
): Promise<MotivoDaSimulacao> {
  if (!canalLigado) return 'agente_desligado'

  const status = await statusDaConversaDeSimulacao(ws, conversaId)
  if (status === null) return 'sem_conversa'
  
  
  if (status === 'aguardando_humano') return 'pediu_humano'
  if (status !== 'aberta') return 'humano_com_a_conversa'

  const estouro = estourou(await lerRodadas(ws, conversaId, Date.now()), acumuladoVazio(), ws, conversaId)
  if (estouro === 'conversa') return 'teto_conversa'
  if (estouro === 'workspace') return 'teto_workspace'
  if (estouro === 'deploy') return 'teto_deploy'
  return 'nao_rodou'
}



export async function simular(
  texto: string,
  assistenteId: string | null = null,
): Promise<ResultadoDaSimulacao> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }

  const limpo = texto.trim()
  if (!limpo) return { erro: TEXTO_VAZIO }
  if (limpo.length > TETO_TEXTO_SIMULADO) return { erro: TEXTO_LONGO }

  try {
    
    
    const canal = await garantirCanalDeSimulacao(ws)
    const { id: conversaId, chaveExterna } = await conversaDeSimulacao(ws, canal)

    
    
    
    
    if (!(await ehConversaDeSimulacao(ws, conversaId))) {
      return { erro: NAO_E_SIMULACAO }
    }

    
    
    
    
    
    await despachar(
      canal,
      [eventoDeSimulacao(chaveExterna, limpo)],
      simuladorAdapter.capabilities.identidadePorTelefone,
    )

    
    
    const teto = await registrarRodadaDeSimulacao(ws, canal.id, conversaId)
    if ('erro' in teto) {
      await revalidarTela()
      return { ok: true, motivo: 'teto_simulacao' }
    }

    
    
    if (!(await getSecret(CHAVE_OPENAI))?.trim()) {
      await revalidarTela()
      return { ok: true, motivo: 'sem_chave' }
    }

    const [job] = await reservarJobDaConversa(ws, conversaId)
    if (!job) {
      await revalidarTela()
      return { ok: true, motivo: await motivoDoSilencio(ws, conversaId, canal.agente_ligado) }
    }

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    let desfecho: 'respondeu' | 'pulou'
    try {
      desfecho = await atenderUmJob(job, acumuladoVazio(), assistenteId)
    } finally {
      await devolverReserva(job).catch((err) => {
        console.warn('[simulador] reserva nao devolvida (nao-fatal):', mensagemSegura(err))
      })
    }
    await revalidarTela()
    if (desfecho === 'respondeu') return { ok: true }
    return { ok: true, motivo: await motivoDoSilencio(ws, conversaId, canal.agente_ligado) }
  } catch (err) {
    
    
    return { erro: mensagemSegura(err) }
  }
}


export async function limpar(): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }

  try {
    const canal = await garantirCanalDeSimulacao(ws)
    if ('erro' in (await podeRecomecarSimulacao(ws, canal.id))) return { erro: TETO_DO_LIMPAR }
    await recomecarSimulacao(ws, canal)
    await revalidarTela()
    return { ok: true }
  } catch (err) {
    return { erro: mensagemSegura(err) }
  }
}
