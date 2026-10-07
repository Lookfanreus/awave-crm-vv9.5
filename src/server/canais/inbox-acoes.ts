'use server'
















import { decidirAtribuicao, podeDevolver, type StatusDaConversa } from '@/lib/canais/assumir'
import { redigirValores } from '@/lib/canais/redigir'
import { agendarJob } from '@/server/agente/jobs'
import { admin } from '@/server/supabase'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { enviarMensagem, ErroDeEnvio } from '@/server/canais/envio'
import { PROVIDER_DE_SIMULACAO } from '@/lib/canais/simulacao'

type Res = { ok: true } | { erro: string }


async function workspaceAtivo(): Promise<string | null> {
  const cliente = await criarClienteServidor()
  return resolverWorkspaceAtivo({ cliente })
}


export async function marcarLida(conversaId: string): Promise<void> {
  
  
  
  
  await exigirEngineLiberado()
  const ws = await workspaceAtivo()
  if (!ws) return
  
  
  
  
  
  
  
  
  
  
  
  
  
  await admin()
    .from('conversas')
    .update({ nao_lidas: 0, atualizado_em: new Date().toISOString() })
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .gt('nao_lidas', 0)
}


export async function arquivar(conversaId: string): Promise<Res> {
  await exigirEngineLiberado()
  const ws = await workspaceAtivo()
  if (!ws) return { erro: 'sem_workspace' }
  
  
  
  
  
  
  
  
  
  
  
  
  
  const { data: escritas, error } = await admin()
    .from('conversas')
    .update({ status: 'arquivada', atualizado_em: new Date().toISOString() })
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .select('id')
  if (error) return { erro: 'falha_ao_arquivar' }
  
  
  
  
  
  
  
  
  
  
  if (((escritas as unknown[] | null) ?? []).length === 0) {
    return { erro: 'conversa_nao_encontrada' }
  }
  return { ok: true }
}


export async function atribuir(conversaId: string, membroId: string | null): Promise<Res> {
  await exigirEngineLiberado()
  const ws = await workspaceAtivo()
  if (!ws) return { erro: 'sem_workspace' }
  const agoraIso = new Date().toISOString()

  
  
  
  
  
  
  
  const { data: linha, error: erroLeitura } = await admin()
    .from('conversas')
    .select('status, atribuida_a, canal_id, canais!inner(provider)')
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .neq('canais.provider', PROVIDER_DE_SIMULACAO)
    .maybeSingle()
  if (erroLeitura) return { erro: 'falha_ao_atribuir' }
  const antes = linha as { status?: string; atribuida_a?: string | null; canal_id?: string } | null
  const statusLido = antes?.status
  if (!statusLido) return { erro: 'conversa_nao_encontrada' }
  const donoLido = antes?.atribuida_a ?? null

  const decisao = decidirAtribuicao({
    statusLido: statusLido as StatusDaConversa,
    membroId,
    agoraIso,
  })
  
  
  
  if (!decisao.ok) return { erro: 'conversa_arquivada' }

  
  
  
  
  
  
  
  
  
  if (!membroId && !podeDevolver({ status: statusLido as StatusDaConversa, atribuidaA: donoLido })) {
    return { erro: 'nada_a_devolver' }
  }

  if (membroId) {
    
    
    
    
    const { data } = await admin()
      .from('membros')
      .select('id')
      .eq('workspace_id', ws)
      .eq('id', membroId)
      .maybeSingle()
    if (!data) return { erro: 'membro_invalido' }
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const { data: escritas, error } = await admin()
    .from('conversas')
    .update({ ...decisao.patch, atualizado_em: agoraIso })
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .eq('status', decisao.statusEsperado)
    .filter('atribuida_a', donoLido ? 'eq' : 'is', donoLido)
    .select('id')
  if (error) return { erro: 'falha_ao_atribuir' }
  if (((escritas as unknown[] | null) ?? []).length === 0) return { erro: 'conversa_mudou' }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (!membroId && antes?.canal_id) {
    try {
      const { data: canal } = await admin()
        .from('canais')
        .select('agente_ligado')
        .eq('workspace_id', ws)
        .eq('id', antes.canal_id)
        .maybeSingle()
      if ((canal as { agente_ligado?: boolean } | null)?.agente_ligado === true) {
        await agendarJob(ws, conversaId, Date.now())
      }
    } catch (err) {
      console.warn('[canais/inbox-acoes] devolvida sem agendar a rodada:', redigirValores(err, []))
    }
  }
  return { ok: true }
}


export async function responder(conversaId: string, texto: string): Promise<Res> {
  await exigirEngineLiberado()
  const ws = await workspaceAtivo()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    await enviarMensagem(ws, conversaId, texto)
    return { ok: true }
  } catch (err) {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    if (err instanceof ErroDeEnvio) return { erro: err.codigo }
    
    
    return { erro: 'falha_ao_enviar' }
  }
}


export async function virarNegocio(
  conversaId: string,
): Promise<{ ok: true; id: string } | { erro: string }> {
  await exigirEngineLiberado()
  const ws = await workspaceAtivo()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    
    
    
    
    const { data: linha, error: e0 } = await admin()
      .from('conversas')
      .select('id, contato_id, negocio_id, chave_externa, canais!inner(provider)')
      .eq('workspace_id', ws)
      .eq('id', conversaId)
      .neq('canais.provider', PROVIDER_DE_SIMULACAO)
      .maybeSingle()
    if (e0) throw e0
    const conversa = linha as {
      contato_id: string | null
      negocio_id: string | null
      chave_externa: string
    } | null
    if (!conversa) return { erro: 'conversa_nao_encontrada' }
    if (conversa.negocio_id) return { ok: true, id: conversa.negocio_id }

    
    
    
    let titulo = conversa.chave_externa
    if (conversa.contato_id) {
      const { data: c } = await admin()
        .from('contatos')
        .select('nome')
        .eq('workspace_id', ws)
        .eq('id', conversa.contato_id)
        .maybeSingle()
      const nome = (c as { nome?: string } | null)?.nome
      if (nome) titulo = nome
    }

    const { data: pipe, error: e1 } = await admin()
      .from('pipelines')
      .select('id')
      .eq('workspace_id', ws)
      .eq('is_padrao', true)
      .maybeSingle()
    if (e1) throw e1
    if (!pipe) return { erro: 'sem_pipeline' }
    const pipelineId = (pipe as { id: string }).id

    const { data: etapa, error: e2 } = await admin()
      .from('etapas')
      .select('id')
      .eq('workspace_id', ws)
      .eq('pipeline_id', pipelineId)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (e2) throw e2
    if (!etapa) return { erro: 'sem_etapa' }
    const etapaId = (etapa as { id: string }).id

    const { data: ultimo, error: e3 } = await admin()
      .from('negocios')
      .select('ordem')
      .eq('workspace_id', ws)
      .eq('etapa_id', etapaId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (e3) throw e3
    const ordem = ((ultimo as { ordem: number } | null)?.ordem ?? -1) + 1

    const { data: novo, error: e4 } = await admin()
      .from('negocios')
      .insert({
        workspace_id: ws,
        titulo,
        contato_id: conversa.contato_id,
        pipeline_id: pipelineId,
        etapa_id: etapaId,
        status: 'aberto',
        ordem,
      })
      .select('id')
      .single()
    if (e4) throw e4
    const negocioId = (novo as { id: string } | null)?.id
    if (!negocioId) return { erro: 'falha_ao_criar' }

    
    
    
    
    await admin()
      .from('conversas')
      .update({ negocio_id: negocioId, atualizado_em: new Date().toISOString() })
      .eq('workspace_id', ws)
      .eq('id', conversaId)

    return { ok: true, id: negocioId }
  } catch {
    return { erro: 'falha_ao_criar' }
  }
}
