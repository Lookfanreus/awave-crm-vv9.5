import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { estadoAgendaNegocio, type EstadoAgenda } from '@/server/crm/agenda'
import { camposFaltantes } from '@/lib/gate-campos'
import { estadoSla, diasNaEtapa, type EstadoSla } from '@/lib/sla'
import { diasAtePrevisao } from '@/lib/previsao'
import { umEmbed } from '@/server/crm/campos-leitura'
import { emLotes } from '@/lib/lote-de-ids'



export type CartaoNegocio = {
  id: string
  titulo: string
  valor: string | null
  etapaId: string
  ordem: number
  contatoNome: string | null
  empresaNome: string | null
  agenda: EstadoAgenda
  
  travado: boolean
  
  diasNaEtapa: number
  sla: EstadoSla
  
  previsao: string | null
  diasAtePrevisao: number | null
  
  responsavelId: string | null
}
export type ColunaBoard = {
  etapaId: string
  nome: string
  cor: string | null
  ordem: number
  cartoes: CartaoNegocio[]
  total: number
  somaValor: number
  slaDias: number | null
  atrasados: number
}
export type BoardData = { pipelineId: string | null; colunas: ColunaBoard[] }


function nomeEmbed(x: unknown): string | null {
  if (!x) return null
  const o = Array.isArray(x) ? x[0] : x
  return (o as { nome?: string } | undefined)?.nome ?? null
}

export async function carregarBoard(cliente: SupabaseClient, workspaceId: string, agora: Date = new Date(), funilId?: string): Promise<BoardData> {
  let pipe: { id: string } | null = null
  if (funilId) {
    const { data, error } = await cliente
      .from('pipelines').select('id').eq('workspace_id', workspaceId).eq('id', funilId).maybeSingle()
    if (error) throw error
    pipe = data as { id: string } | null
  }
  if (!pipe) {
    const { data, error } = await cliente
      .from('pipelines').select('id').eq('workspace_id', workspaceId).eq('is_padrao', true).maybeSingle()
    if (error) throw error
    pipe = data as { id: string } | null
  }
  if (!pipe) return { pipelineId: null, colunas: [] }
  const pipelineId = pipe.id

  const { data: etapas, error: e1 } = await cliente
    .from('etapas').select('id, nome, cor, ordem, sla_dias')
    .eq('workspace_id', workspaceId).eq('pipeline_id', pipelineId).order('ordem', { ascending: true })
  if (e1) throw e1

  
  const slaPorEtapa = new Map<string, number | null>(
    ((etapas ?? []) as { id: string; sla_dias: number | null }[]).map((e) => [e.id, e.sla_dias ?? null]),
  )

  const { data: negs, error: e2 } = await cliente
    .from('negocios')
    .select('id, titulo, valor, etapa_id, ordem, campos, etapa_desde, previsao_fechamento, responsavel_id, contatos(nome), empresas(nome)')
    .eq('workspace_id', workspaceId).eq('pipeline_id', pipelineId).eq('status', 'aberto')
    .order('ordem', { ascending: true }).order('criado_em', { ascending: true })
  if (e2) throw e2

  const linhasNeg = (negs ?? []) as Record<string, unknown>[]
  const ids = linhasNeg.map((n) => n.id as string)

  
  const estadoPorNegocio = new Map<string, EstadoAgenda>()
  if (ids.length > 0) {
    
    
    
    
    
    
    
    
    
    const linhasAgenda: Record<string, unknown>[] = []
    for (const lote of emLotes(ids)) {
      const { data: ags, error: e3 } = await cliente
        .from('atividades')
        .select('negocio_id, vencimento, concluida_em')
        .eq('workspace_id', workspaceId)
        .in('negocio_id', lote)
        .not('vencimento', 'is', null)
        .is('concluida_em', null)
      if (e3) throw e3
      linhasAgenda.push(...((ags ?? []) as Record<string, unknown>[]))
    }
    const porNeg = new Map<string, { vencimento: string | null; concluida_em: string | null }[]>()
    for (const a of linhasAgenda) {
      const nid = a.negocio_id as string
      const arr = porNeg.get(nid) ?? []
      arr.push({ vencimento: a.vencimento as string | null, concluida_em: a.concluida_em as string | null })
      porNeg.set(nid, arr)
    }
    for (const nid of ids) estadoPorNegocio.set(nid, estadoAgendaNegocio(porNeg.get(nid) ?? [], agora))
  }

  
  
  const idsEtapas = ((etapas ?? []) as { id: string }[]).map((e) => e.id)
  const obrigatoriosPorEtapa = new Map<string, string[]>()
  if (idsEtapas.length > 0) {
    const { data: regras, error: eR } = await cliente
      .from('campos_etapa')
      .select('etapa_id, obrigatorio, campos_def!campos_etapa_campo_fk(slug, ativo)')
      .eq('workspace_id', workspaceId).in('etapa_id', idsEtapas).eq('obrigatorio', true)
    if (eR) throw eR
    for (const r of (regras ?? []) as Array<{ etapa_id: string; campos_def: unknown }>) {
      const def = umEmbed<{ slug: string; ativo: boolean }>(r.campos_def)
      if (!def?.ativo) continue
      const arr = obrigatoriosPorEtapa.get(r.etapa_id) ?? []
      arr.push(def.slug)
      obrigatoriosPorEtapa.set(r.etapa_id, arr)
    }
  }

  const porEtapa = new Map<string, CartaoNegocio[]>()
  for (const n of linhasNeg) {
    const previsao = (n.previsao_fechamento as string | null) ?? null
    const c: CartaoNegocio = {
      id: n.id as string,
      titulo: n.titulo as string,
      valor: (n.valor as string | null) ?? null,
      etapaId: n.etapa_id as string,
      ordem: n.ordem as number,
      contatoNome: nomeEmbed(n.contatos),
      empresaNome: nomeEmbed(n.empresas),
      agenda: estadoPorNegocio.get(n.id as string) ?? 'sem',
      travado: camposFaltantes(
        obrigatoriosPorEtapa.get(n.etapa_id as string) ?? [],
        (n.campos as Record<string, unknown> | null) ?? {},
      ).length > 0,
      diasNaEtapa: diasNaEtapa(n.etapa_desde as string, agora),
      sla: estadoSla(n.etapa_desde as string, slaPorEtapa.get(n.etapa_id as string) ?? null, agora),
      previsao,
      diasAtePrevisao: previsao ? diasAtePrevisao(previsao, agora) : null,
      responsavelId: (n.responsavel_id as string | null) ?? null,
    }
    const arr = porEtapa.get(c.etapaId) ?? []
    arr.push(c)
    porEtapa.set(c.etapaId, arr)
  }

  const colunas: ColunaBoard[] = ((etapas ?? []) as Record<string, unknown>[]).map((e) => {
    const cartoes = porEtapa.get(e.id as string) ?? []
    return {
      etapaId: e.id as string,
      nome: e.nome as string,
      cor: (e.cor as string | null) ?? null,
      ordem: e.ordem as number,
      cartoes,
      total: cartoes.length,
      somaValor: cartoes.reduce((s, c) => s + Number(c.valor ?? 0), 0),
      slaDias: (e.sla_dias as number | null) ?? null,
      atrasados: cartoes.filter((c) => c.sla === 'estourado').length,
    }
  })
  return { pipelineId, colunas }
}
