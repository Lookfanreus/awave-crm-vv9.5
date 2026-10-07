import 'server-only'
import { admin } from '@/server/supabase'
import { registrarAtividade } from '@/server/crm/atividades'
import { atualizarNegocio, moverParaEtapa, criarNegocio, buscarNegocio } from '@/server/crm/negocios'
import { buscarEtapa } from '@/server/crm/pipelines'
import { logEtapaMudou } from '@/server/crm/timeline'
import {
  CrmTipoDesconhecido,
  CrmAtividadeSemAlvo,
  CrmCamposObrigatorios,
  CrmCamposInvalidos,
  CrmNegocioNaoEncontrado,
  CrmEtapaNaoEncontrada,
  CrmEtapaDeOutroPipeline,
} from '@/server/crm/erros'
import { slugAutomacao } from '@/lib/slug'
import { resolverMapaCampos, precisaNegocioOrigem } from '@/lib/automacao-mapa-campos'
import type { ItemAcao } from '@/lib/automacao-forma'
import { detalheSeguro } from '@/lib/sanitizar-erro'



type Cli = ReturnType<typeof admin>


export type CtxAcao = {
  workspaceId: string
  negocioId: string | null
  automacaoId: string
  agora: Date
}


export type ResultadoAcao =
  | { ok: true; detalhe?: unknown; negociosCriados?: string[] }
  | { ok: false; erro: string; detalhe?: unknown }


export async function executarAcao(cli: Cli, ctx: CtxAcao, acao: ItemAcao): Promise<ResultadoAcao> {
  try {
    switch (acao.tipo) {
      case 'criar_atividade':
        return await criarAtividade(ctx, acao)
      case 'atribuir_responsavel':
        return await atribuirResponsavel(cli, ctx, acao)
      case 'mover_etapa':
        return await moverEtapa(cli, ctx, acao)
      case 'chamar_webhook':
        return await chamarWebhook(cli, ctx, acao)
      case 'atualizar_campo':
        return await atualizarCampo(ctx, acao)
      case 'criar_negocio':
        return await criarNegocioAcao(ctx, acao)
      default:
        return { ok: false, erro: 'acao_nao_implementada' }
    }
  } catch (err) {
    if (err instanceof CrmTipoDesconhecido) return { ok: false, erro: 'tipo_desconhecido' }
    if (err instanceof CrmAtividadeSemAlvo) return { ok: false, erro: 'sem_alvo' }
    
    
    
    if (err instanceof CrmCamposObrigatorios) return { ok: false, erro: 'campos_obrigatorios', detalhe: { slugs: err.slugs } }
    
    
    
    if (err instanceof CrmCamposInvalidos) return { ok: false, erro: 'campo_invalido', detalhe: { slugs: err.slugs } }
    if (err instanceof CrmNegocioNaoEncontrado) return { ok: false, erro: 'negocio_nao_encontrado' }
    if (err instanceof CrmEtapaNaoEncontrada) return { ok: false, erro: 'etapa_nao_encontrada' }
    if (err instanceof CrmEtapaDeOutroPipeline) return { ok: false, erro: 'etapa_de_outro_pipeline' }
    
    console.error('[automacao] executarAcao', acao.tipo, detalheSeguro(err))
    return { ok: false, erro: 'erro_inesperado' }
  }
}


async function criarAtividade(ctx: CtxAcao, acao: ItemAcao): Promise<ResultadoAcao> {
  const tipoSlug = acao.tipo_slug as string
  const conteudo = typeof acao.conteudo === 'string' ? acao.conteudo : undefined
  const vencimentoDias = typeof acao.vencimento_dias === 'number' ? acao.vencimento_dias : undefined
  const vencimento = vencimentoDias !== undefined
    ? new Date(ctx.agora.getTime() + vencimentoDias * 86_400_000).toISOString()
    : undefined

  const atividade = await registrarAtividade(ctx.workspaceId, {
    tipo: tipoSlug,
    conteudo,
    negocio_id: ctx.negocioId,
    vencimento,
  })
  return { ok: true, detalhe: { atividade_id: atividade.id } }
}


async function atribuirResponsavel(cli: Cli, ctx: CtxAcao, acao: ItemAcao): Promise<ResultadoAcao> {
  if (!ctx.negocioId) return { ok: false, erro: 'sem_negocio' }

  const membroFixo = typeof acao.membro_id === 'string' ? acao.membro_id : undefined
  const membroId = membroFixo ?? (await escolherPorRodizio(cli, ctx))
  if (!membroId) return { ok: false, erro: 'sem_membros' }

  await atualizarNegocio(ctx.workspaceId, ctx.negocioId, { responsavel_id: membroId })
  return { ok: true, detalhe: { responsavel_id: membroId } }
}


async function moverEtapa(cli: Cli, ctx: CtxAcao, acao: ItemAcao): Promise<ResultadoAcao> {
  if (!ctx.negocioId) return { ok: false, erro: 'sem_negocio' }

  const etapaId = acao.etapa_id as string
  await moverParaEtapa(ctx.workspaceId, ctx.negocioId, { etapaId })
  try {
    const etapa = await buscarEtapa(ctx.workspaceId, etapaId)
    if (etapa) await logEtapaMudou(cli, ctx.workspaceId, ctx.negocioId, etapa.nome)
  } catch {
    
  }
  return { ok: true }
}


async function atualizarCampo(ctx: CtxAcao, acao: ItemAcao): Promise<ResultadoAcao> {
  if (!ctx.negocioId) return { ok: false, erro: 'sem_negocio' }

  const slug = acao.campo as string
  await atualizarNegocio(ctx.workspaceId, ctx.negocioId, { campos: { [slug]: acao.valor } })
  return { ok: true, detalhe: { campo: slug } }
}


async function criarNegocioAcao(ctx: CtxAcao, acao: ItemAcao): Promise<ResultadoAcao> {
  const titulo = acao.titulo as string
  const mapaCampos = acao.mapa_campos && typeof acao.mapa_campos === 'object'
    ? acao.mapa_campos as Record<string, unknown>
    : undefined

  let origemCampos: Record<string, unknown> = {}
  if (mapaCampos && precisaNegocioOrigem(mapaCampos)) {
    if (!ctx.negocioId) return { ok: false, erro: 'sem_negocio' }
    const origem = await buscarNegocio(ctx.workspaceId, ctx.negocioId)
    if (!origem) throw new CrmNegocioNaoEncontrado()
    origemCampos = origem.campos ?? {}
  }

  let pipelineId = typeof acao.pipeline_id === 'string' && acao.pipeline_id ? acao.pipeline_id : undefined
  const etapaId = typeof acao.etapa_id === 'string' && acao.etapa_id ? acao.etapa_id : undefined
  if (etapaId && !pipelineId) {
    const etapa = await buscarEtapa(ctx.workspaceId, etapaId)
    if (!etapa) throw new CrmEtapaNaoEncontrada()
    pipelineId = etapa.pipeline_id
  }

  const negocio = await criarNegocio(ctx.workspaceId, {
    titulo,
    pipeline_id: pipelineId,
    etapa_id: etapaId,
    campos: mapaCampos ? resolverMapaCampos(mapaCampos, origemCampos) : undefined,
  })
  return { ok: true, detalhe: { negocio_id: negocio.id }, negociosCriados: [negocio.id] }
}


async function chamarWebhook(cli: Cli, ctx: CtxAcao, acao: ItemAcao): Promise<ResultadoAcao> {
  const { data: cfgData, error: erroConfig } = await cli
    .from('webhook_config')
    .select('ativo')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()
  if (erroConfig) throw erroConfig
  const config = cfgData as { ativo: boolean } | null
  if (!config || !config.ativo) return { ok: true, detalhe: 'pulado: webhook_nao_configurado' }

  const { data: automacaoData, error: erroAutomacao } = await cli
    .from('automacoes')
    .select('nome')
    .eq('workspace_id', ctx.workspaceId)
    .eq('id', ctx.automacaoId)
    .maybeSingle()
  if (erroAutomacao) throw erroAutomacao
  const nome = (automacaoData as { nome: string } | null)?.nome ?? ''

  const { error: erroInsert } = await cli
    .from('eventos_webhook')
    .insert({
      workspace_id: ctx.workspaceId,
      tipo: 'automacao.' + slugAutomacao(nome),
      payload: { negocio_id: ctx.negocioId, automacao_id: ctx.automacaoId, dados: acao.dados ?? null },
    })
  if (erroInsert) throw erroInsert
  return { ok: true }
}


async function escolherPorRodizio(cli: Cli, ctx: CtxAcao): Promise<string | null> {
  const { data, error } = await cli
    .from('membros')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .order('criado_em')
  if (error) throw error
  const membros = (data as { id: string }[] | null) ?? []
  if (membros.length === 0) return null

  const { count, error: erroContagem } = await cli
    .from('execucoes_automacao')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId)
    .eq('automacao_id', ctx.automacaoId)
    .eq('estado', 'ok')
  if (erroContagem) throw erroContagem

  const indice = (count ?? 0) % membros.length
  return membros[indice].id
}
