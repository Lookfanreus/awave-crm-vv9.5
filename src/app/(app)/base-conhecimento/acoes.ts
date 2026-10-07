'use server'

import { exigirEngineLiberado } from '@/server/license/exigir'
import { ehOwnerDoWorkspace } from '@/server/auth/owner-workspace'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { admin } from '@/server/supabase'
import { embedar } from '@/server/agente/embed'



import {
  ORIGEM_DO_OPERADOR,
  TETO_REPROCESSO_POR_CLIQUE,
  validarEntrada,
} from '@/lib/canais/base-conhecimento'
import { mensagemSegura, detalheSeguro } from '@/lib/sanitizar-erro'
import { fraseDeBanco } from '@/lib/erro-de-banco'



export type ResultadoSimples = { ok: true } | { erro: string }

export type ResultadoDoSalvar = { ok: true; id: string } | { erro: string }

const SO_O_OWNER = 'Só quem administra este espaço de trabalho pode alterar o que o assistente sabe.'
const SEM_WS = 'Você não está em nenhum espaço de trabalho.'
const ENTRADA_DESCONHECIDA = 'Essa entrada não existe neste espaço de trabalho. Recarregue a página e tente de novo.'

const ASSISTENTE_DESCONHECIDO_NO_RECORTE =
  'Um dos assistentes escolhidos não existe mais neste espaço de trabalho. Recarregue a página e tente de novo.'

const NAO_CONFIRMOU_GRAVACAO =
  'Não consegui confirmar a gravação. Antes de tentar de novo, confira na lista abaixo se a entrada já foi criada — para não duplicá-la.'

const NAO_CONFIRMOU_RECORTE =
  'Não consegui confirmar a alteração. Recarregue a página para ver quem realmente está no recorte e tente de novo.'
const ROTA = '/base-conhecimento'

const ROTA_RESUMO_DO_ASSISTENTE = '/agentes'

async function wsDaSessao(): Promise<string | null> {
  const cliente = await criarClienteServidor()
  return resolverWorkspaceAtivo({ cliente })
}


function falha(err: unknown): { erro: string } {
  console.error('[base] falha:', detalheSeguro(err))
  return { erro: fraseDeBanco(err) }
}


async function revalidarTela(): Promise<void> {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath(ROTA)
    revalidatePath(ROTA_RESUMO_DO_ASSISTENTE)
  } catch (err) {
    console.warn('[base] revalidatePath falhou (não-fatal):', mensagemSegura(err))
  }
}


function textoParaVetor(titulo: string, conteudo: string): string {
  return `${titulo}\n${conteudo}`
}


export async function salvarEntrada(dados: {
  id?: string
  titulo: string
  conteudo: string
  tipo: string
}): Promise<ResultadoDoSalvar> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }

  
  const v = validarEntrada(dados)
  if (!v.ok) return { erro: v.erro }

  try {
    const vetor = await embedar(textoParaVetor(v.valor.titulo, v.valor.conteudo), {
      ws,
      conversaId: null,
    })
    const agora = new Date().toISOString()
    const texto = {
      titulo: v.valor.titulo,
      conteudo: v.valor.conteudo,
      tipo: v.valor.tipo,
      embedding: vetor?.vetor ?? null,
      embed_versao: vetor?.versao ?? null,
      atualizado_em: agora,
    }

    if (dados.id) {
      
      
      const { error } = await admin()
        .from('base_conhecimento')
        .update(texto)
        .eq('workspace_id', ws)
        .eq('id', dados.id)
      if (error) return falha(error)
      await revalidarTela()
      
      
      return { ok: true, id: dados.id }
    } else {
      
      
      
      const { data: criadas, error } = await admin()
        .from('base_conhecimento')
        .insert({ ...texto, workspace_id: ws, origem: ORIGEM_DO_OPERADOR, criado_em: agora })
        .select('id')
      if (error) return falha(error)
      const novoId = (criadas as Array<{ id: string }> | null)?.[0]?.id
      
      
      
      if (!novoId) return { erro: NAO_CONFIRMOU_GRAVACAO }
      await revalidarTela()
      return { ok: true, id: novoId }
    }
  } catch (err) {
    return falha(err)
  }
}


export async function alternarEntrada(id: string, habilitado: boolean): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }

  try {
    const { error } = await admin()
      .from('base_conhecimento')
      .update({ habilitado, atualizado_em: new Date().toISOString() })
      .eq('workspace_id', ws)
      .eq('id', id)
    if (error) return falha(error)
    await revalidarTela()
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}

export async function excluirEntrada(id: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }

  try {
    const { error } = await admin()
      .from('base_conhecimento')
      .delete()
      .eq('workspace_id', ws)
      .eq('id', id)
    if (error) return falha(error)
    await revalidarTela()
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function reprocessarPendentes(): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }

  try {
    const { data, error } = await admin()
      .from('base_conhecimento')
      .select('id, titulo, conteudo')
      .eq('workspace_id', ws)
      .is('embed_versao', null)
      .limit(TETO_REPROCESSO_POR_CLIQUE)
    if (error) return falha(error)

    const pendentes = ((data ?? []) as Array<{ id: string; titulo: string; conteudo: string }>).slice(
      0,
      TETO_REPROCESSO_POR_CLIQUE,
    )

    for (const p of pendentes) {
      const vetor = await embedar(textoParaVetor(p.titulo, p.conteudo), { ws, conversaId: null })
      
      
      if (!vetor) continue
      await admin()
        .from('base_conhecimento')
        .update({ embedding: vetor.vetor, embed_versao: vetor.versao })
        .eq('workspace_id', ws)
        .eq('id', p.id)
    }

    await revalidarTela()
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export type RecorteDoBloco = { modo: 'todos' } | { modo: 'so_estes'; ids: string[] }

const RECORTE_SEM_ASSISTENTE =
  'Escolha pelo menos um assistente para "só estes" — ou troque para "todos os assistentes".'


const RECORTE_TROCADO = 1
const RECORTE_BLOCO_DE_FORA = 0
const RECORTE_ASSISTENTE_DE_FORA = 2


export async function salvarRecorteDoBloco(
  blocoId: string,
  recorte: RecorteDoBloco,
): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }

  
  
  
  
  if (recorte.modo === 'so_estes' && recorte.ids.length === 0) {
    return { erro: RECORTE_SEM_ASSISTENTE }
  }

  try {
    
    
    
    
    const assistentes = recorte.modo === 'so_estes' ? [...new Set(recorte.ids)] : []

    
    
    const { data, error } = await admin().rpc('trocar_recorte_do_bloco', {
      p_ws: ws,
      p_bloco: blocoId,
      p_assistentes: assistentes,
    })
    if (error) return falha(error)
    if (data === RECORTE_BLOCO_DE_FORA) return { erro: ENTRADA_DESCONHECIDA }
    if (data === RECORTE_ASSISTENTE_DE_FORA) return { erro: ASSISTENTE_DESCONHECIDO_NO_RECORTE }
    if (data !== RECORTE_TROCADO) return { erro: NAO_CONFIRMOU_RECORTE }

    await revalidarTela()
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}
