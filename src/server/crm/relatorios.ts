import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { admin } from '@/server/supabase'
import { CrmRelatorioTipoInvalido } from '@/server/crm/erros'
import { lerDefsUI } from '@/server/crm/campos-leitura'
import {
  conversaoPorEtapa, tempoPorEtapa, forecast, pivot,
  limparConfig, ehTipoRelatorio,
  AGRUP_ETAPA, AGRUP_STATUS, AGRUPAMENTOS_FIXOS, ROTULO_STATUS,
  type ConfigRelatorio, type TipoRelatorio, type ResultadoRelatorio,
  type EtapaRelatorio, type LinhaHistorico, type LinhaForecast, type LinhaPivot,
  type FunilInfo, type Aviso, type AgrupamentoInfo, type StatusFiltro, type ValorMonetario,
} from '@/lib/relatorios'
import type { OpcaoCampo } from '@/lib/campos-valor'
import { detalheSeguro } from '@/lib/sanitizar-erro'




export const TETO_LINHAS = 20_000

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type RelatorioSalvo = {
  id: string
  nome: string
  tipo: TipoRelatorio
  config: ConfigRelatorio
  criado_em: string
  atualizado_em: string
}

type Res = { ok: true } | { erro: string }
type ResId = { ok: true; id: string } | { erro: string }

const MAX_NOME = 120



function paraSalvo(l: Record<string, unknown>): RelatorioSalvo | null {
  
  
  
  if (!ehTipoRelatorio(l.tipo)) return null
  return {
    id: l.id as string,
    nome: l.nome as string,
    tipo: l.tipo,
    config: limparConfig(l.config),
    criado_em: l.criado_em as string,
    atualizado_em: l.atualizado_em as string,
  }
}

const SEL_SALVO = 'id, nome, tipo, config, criado_em, atualizado_em'

export async function listarRelatorios(cliente: SupabaseClient, ws: string): Promise<RelatorioSalvo[]> {
  const { data, error } = await cliente
    .from('relatorios')
    .select(SEL_SALVO)
    .eq('workspace_id', ws)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return ((data as Record<string, unknown>[] | null) ?? [])
    .map(paraSalvo)
    .filter((r): r is RelatorioSalvo => r !== null)
}

export async function buscarRelatorio(
  cliente: SupabaseClient, ws: string, id: string,
): Promise<RelatorioSalvo | null> {
  
  
  if (!RE_UUID.test(id)) return null
  const { data, error } = await cliente
    .from('relatorios')
    .select(SEL_SALVO)
    .eq('workspace_id', ws)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? paraSalvo(data as Record<string, unknown>) : null
}


export async function salvarRelatorio(
  cliente: SupabaseClient,
  ws: string,
  entrada: { id?: string | null; nome: string; tipo: string; config: unknown; criadoPor?: string | null },
): Promise<ResId> {
  const nome = (entrada.nome ?? '').trim()
  if (!nome) return { erro: 'nome_vazio' }
  if (nome.length > MAX_NOME) return { erro: 'nome_longo' }
  if (!ehTipoRelatorio(entrada.tipo)) return { erro: 'tipo_invalido' }
  const config = limparConfig(entrada.config)

  try {
    if (entrada.id) {
      if (!RE_UUID.test(entrada.id)) return { erro: 'nao_encontrado' }
      const { data, error } = await cliente
        .from('relatorios')
        .update({ nome, tipo: entrada.tipo, config })
        .eq('workspace_id', ws)
        .eq('id', entrada.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return { erro: 'nao_encontrado' }
      return { ok: true, id: (data as { id: string }).id }
    }
    const { data, error } = await cliente
      .from('relatorios')
      .insert({ workspace_id: ws, nome, tipo: entrada.tipo, config, criado_por: entrada.criadoPor ?? null })
      .select('id')
      .single()
    if (error) throw error
    return { ok: true, id: (data as { id: string }).id }
  } catch (err) {
    console.error('[relatorios] salvar', detalheSeguro(err))
    return { erro: 'falha_salvar' }
  }
}

export async function excluirRelatorio(cliente: SupabaseClient, ws: string, id: string): Promise<Res> {
  if (!RE_UUID.test(id)) return { erro: 'nao_encontrado' }
  try {
    const { error } = await cliente.from('relatorios').delete().eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) {
    console.error('[relatorios] excluir', detalheSeguro(err))
    return { erro: 'falha_excluir' }
  }
}



let cacheCorte: Promise<string | null> | null = null


export async function corteBackfill(): Promise<string | null> {
  if (!cacheCorte) {
    cacheCorte = (async () => {
      try {
        const { data, error } = await admin()
          .from('awave_migrations')
          .select('applied_at')
          .eq('version', '0012')
          .maybeSingle()
        if (error) throw error
        return (data as { applied_at: string } | null)?.applied_at ?? null
      } catch (err) {
        console.error('[relatorios] corteBackfill', detalheSeguro(err))
        return null
      }
    })()
  }
  return cacheCorte
}



type EtapaComProbabilidade = EtapaRelatorio & { probabilidade: number | null }


async function resolverFunil(
  cliente: SupabaseClient, ws: string, funilId: string | null,
): Promise<FunilInfo | null> {
  if (funilId) {
    const { data, error } = await cliente
      .from('pipelines').select('id, nome').eq('workspace_id', ws).eq('id', funilId).maybeSingle()
    if (error) throw error
    if (data) return data as FunilInfo
  }
  const { data, error } = await cliente
    .from('pipelines').select('id, nome').eq('workspace_id', ws).eq('is_padrao', true).maybeSingle()
  if (error) throw error
  return (data as FunilInfo | null) ?? null
}

async function lerEtapas(
  cliente: SupabaseClient, ws: string, funilId: string,
): Promise<EtapaComProbabilidade[]> {
  const { data, error } = await cliente
    .from('etapas')
    .select('id, nome, ordem, probabilidade')
    .eq('workspace_id', ws)
    .eq('pipeline_id', funilId)
    .order('ordem')
  if (error) throw error
  return (data as EtapaComProbabilidade[] | null) ?? []
}


function limitesPeriodo(config: ConfigRelatorio): { desde: string | null; ateExclusivo: string | null } {
  const desde = config.de ? `${config.de}T00:00:00.000Z` : null
  let ateExclusivo: string | null = null
  if (config.ate) {
    const [a, m, d] = config.ate.split('-').map(Number)
    const limite = new Date(Date.UTC(a, m - 1, d + 1))
    ateExclusivo = Number.isNaN(limite.getTime()) ? null : limite.toISOString()
  }
  return { desde, ateExclusivo }
}

function avisoBase(teto: number): Aviso {
  return { truncado: false, teto, aproximados: 0, corte: null }
}


async function lerHistorico(
  cliente: SupabaseClient, ws: string, etapaIds: string[], config: ConfigRelatorio, teto: number,
): Promise<{ linhas: LinhaHistorico[]; truncado: boolean }> {
  const { desde, ateExclusivo } = limitesPeriodo(config)
  let q = cliente
    .from('historico_etapas')
    .select('negocio_id, etapa_id, entrou_em, saiu_em')
    .eq('workspace_id', ws)
    .in('etapa_id', etapaIds)
  if (desde) q = q.gte('entrou_em', desde) as typeof q
  if (ateExclusivo) q = q.lt('entrou_em', ateExclusivo) as typeof q
  
  const { data, error } = await q.order('entrou_em', { ascending: true }).limit(teto + 1)
  if (error) throw error
  const linhas = (data as LinhaHistorico[] | null) ?? []
  return linhas.length > teto ? { linhas: linhas.slice(0, teto), truncado: true } : { linhas, truncado: false }
}


function contarAproximados(linhas: LinhaHistorico[], corte: string | null): number {
  if (!corte) return 0
  const t = new Date(corte).getTime()
  if (Number.isNaN(t)) return 0
  const negocios = new Set<string>()
  for (const l of linhas) {
    const entrou = new Date(l.entrou_em).getTime()
    if (!Number.isNaN(entrou) && entrou < t) negocios.add(l.negocio_id)
  }
  return negocios.size
}


async function lerNegocios(
  cliente: SupabaseClient, ws: string, funilId: string, config: ConfigRelatorio,
  colunas: string, status: StatusFiltro, teto: number,
): Promise<{ linhas: Record<string, unknown>[]; truncado: boolean }> {
  const { desde, ateExclusivo } = limitesPeriodo(config)
  let q = cliente
    .from('negocios')
    .select(colunas)
    .eq('workspace_id', ws)
    .eq('pipeline_id', funilId)
  if (status !== 'todos') q = q.eq('status', status) as typeof q
  if (desde) q = q.gte('criado_em', desde) as typeof q
  if (ateExclusivo) q = q.lt('criado_em', ateExclusivo) as typeof q
  const { data, error } = await q.order('criado_em', { ascending: true }).limit(teto + 1)
  if (error) throw error
  const linhas = ((data ?? []) as unknown as Record<string, unknown>[])
  return linhas.length > teto ? { linhas: linhas.slice(0, teto), truncado: true } : { linhas, truncado: false }
}


export async function opcoesAgrupamento(
  cliente: SupabaseClient, ws: string, funilId?: string,
): Promise<Array<{ slug: string; rotulo: string }>> {
  const defs = await lerDefsUI(cliente, ws, 'negocio', funilId)
  return [...AGRUPAMENTOS_FIXOS, ...defs.map((d) => ({ slug: d.slug, rotulo: d.rotulo }))]
}


async function resolverAgrupamento(
  cliente: SupabaseClient, ws: string, funilId: string, slugPedido: string | null,
  etapas: EtapaComProbabilidade[],
): Promise<{ info: AgrupamentoInfo; opcoes?: OpcaoCampo[] }> {
  const slug = slugPedido ?? AGRUP_ETAPA

  if (slug === AGRUP_ETAPA) {
    return {
      info: { slug, rotulo: 'Etapa', multipla: false },
      opcoes: etapas.map((e) => ({ id: e.id, rotulo: e.nome })),
    }
  }
  if (slug === AGRUP_STATUS) {
    return {
      info: { slug, rotulo: 'Situação', multipla: false },
      opcoes: (['aberto', 'ganho', 'perdido'] as const).map((s) => ({ id: s, rotulo: ROTULO_STATUS[s] })),
    }
  }

  const defs = await lerDefsUI(cliente, ws, 'negocio', funilId)
  const def = defs.find((d) => d.slug === slug)
  if (!def) return { info: { slug, rotulo: slug, multipla: false } }
  return {
    info: { slug, rotulo: def.rotulo, multipla: def.tipo === 'selecao_multipla' },
    opcoes: def.opcoes,
  }
}


export async function rodarRelatorio(
  cliente: SupabaseClient,
  ws: string,
  tipo: TipoRelatorio,
  configBruta: unknown,
  agora: Date = new Date(),
  opcoes: { teto?: number; corte?: string | null } = {},
): Promise<ResultadoRelatorio> {
  if (!ehTipoRelatorio(tipo)) throw new CrmRelatorioTipoInvalido(String(tipo))
  const config = limparConfig(configBruta)
  const teto = opcoes.teto ?? TETO_LINHAS
  const periodo = { de: config.de, ate: config.ate }

  const funil = await resolverFunil(cliente, ws, config.funilId)
  
  
  if (!funil) return vazio(tipo, null, periodo, avisoBase(teto))

  const etapas = await lerEtapas(cliente, ws, funil.id)

  if (tipo === 'funil_conversao' || tipo === 'tempo_por_etapa') {
    if (etapas.length === 0) return vazio(tipo, funil, periodo, avisoBase(teto))
    const { linhas, truncado } = await lerHistorico(cliente, ws, etapas.map((e) => e.id), config, teto)
    const corte = opcoes.corte === undefined ? await corteBackfill() : opcoes.corte
    const aproximados = contarAproximados(linhas, corte)
    const aviso: Aviso = { truncado, teto, aproximados, corte: aproximados > 0 ? corte : null }
    return tipo === 'funil_conversao'
      ? { tipo, funil, periodo, aviso, linhas: conversaoPorEtapa(linhas, etapas) }
      
      
      : { tipo, funil, periodo, aviso, linhas: tempoPorEtapa(linhas, agora, etapas) }
  }

  if (tipo === 'forecast') {
    
    
    const { linhas, truncado } = await lerNegocios(
      cliente, ws, funil.id, config, 'valor, etapa_id', 'aberto', teto,
    )
    const probPorEtapa = new Map(etapas.map((e) => [e.id, e.probabilidade]))
    const entradas: LinhaForecast[] = linhas.map((n) => ({
      
      
      
      valor: (n.valor as ValorMonetario) ?? null,
      probabilidade: probPorEtapa.get(n.etapa_id as string) ?? null,
    }))
    return { tipo, funil, periodo, aviso: { ...avisoBase(teto), truncado }, resultado: forecast(entradas) }
  }

  
  const { linhas, truncado } = await lerNegocios(
    cliente, ws, funil.id, config, 'valor, campos, etapa_id, status', config.status, teto,
  )
  const { info, opcoes: catalogo } = await resolverAgrupamento(cliente, ws, funil.id, config.agrupamento, etapas)
  
  
  const entradas: LinhaPivot[] = linhas.map((n) => ({
    valor: (n.valor as ValorMonetario) ?? null,
    campos: {
      ...((n.campos as Record<string, unknown> | null) ?? {}),
      [AGRUP_ETAPA]: n.etapa_id,
      [AGRUP_STATUS]: n.status,
    },
  }))
  return {
    tipo, funil, periodo,
    aviso: { ...avisoBase(teto), truncado },
    grupos: pivot(entradas, info.slug, catalogo),
    agrupamento: info,
    totalNegocios: linhas.length,
  }
}


function vazio(
  tipo: TipoRelatorio, funil: FunilInfo | null, periodo: { de: string | null; ate: string | null }, aviso: Aviso,
): ResultadoRelatorio {
  switch (tipo) {
    case 'funil_conversao': return { tipo, funil, periodo, aviso, linhas: [] }
    case 'tempo_por_etapa': return { tipo, funil, periodo, aviso, linhas: [] }
    case 'forecast':
      return { tipo, funil, periodo, aviso, resultado: { total: '0.00', considerados: 0, semProbabilidade: 0, semValor: 0 } }
    case 'tabela':
      return {
        tipo, funil, periodo, aviso, grupos: [], totalNegocios: 0,
        agrupamento: { slug: AGRUP_ETAPA, rotulo: 'Etapa', multipla: false },
      }
  }
}
