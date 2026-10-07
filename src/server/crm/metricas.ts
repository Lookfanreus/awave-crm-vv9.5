import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { diasAtePrevisao } from '@/lib/previsao'




export type PeriodoDias = 7 | 30 | 90


export type MetricaFluxo = {
  atual: number
  anterior: number
  
  variacao: number | null
  
  unidade: 'pct' | 'pp'
}

export type Kpis = {
  
  negociosAbertos: number
  valorEmAberto: number
  
  ganhos: MetricaFluxo
  ganhosCount: number
  conversao: MetricaFluxo
  ticketMedio: MetricaFluxo
}

export type EtapaMetrica = {
  etapaId: string
  nome: string
  cor: string | null
  count: number
  
  valor: number
}


type ComQuem = { pessoa: string | null }

export type NegocioPrevisto = ComQuem & {
  id: string
  titulo: string
  valor: number
  etapaId: string
  previsao: string
  
  diasAte: number
}

export type NegocioParado = ComQuem & {
  id: string
  titulo: string
  valor: number
  etapaId: string
  diasParado: number
}




function quemEmbed(contato: unknown, empresa: unknown): string | null {
  const nome = (x: unknown) => (Array.isArray(x) ? x[0] : x) as { nome?: string } | null | undefined
  return nome(contato)?.nome ?? nome(empresa)?.nome ?? null
}


function somarValores(linhas: Array<{ valor: string | null }>): number {
  return linhas.reduce((acc, l) => acc + Number(l.valor ?? 0), 0)
}

const DIA_MS = 24 * 60 * 60 * 1000


export function janelas(agora: Date, dias: number): { iniA: string; iniB: string; fimB: string } {
  const iniA = new Date(agora.getTime() - dias * DIA_MS)
  const iniB = new Date(agora.getTime() - 2 * dias * DIA_MS)
  return { iniA: iniA.toISOString(), iniB: iniB.toISOString(), fimB: iniA.toISOString() }
}


export function fluxo(atual: number, anterior: number, unidade: 'pct' | 'pp' = 'pct'): MetricaFluxo {
  let variacao: number | null = null
  if (unidade === 'pp') {
    
    
    
    variacao = atual - anterior
  } else if (anterior !== 0) {
    variacao = ((atual - anterior) / Math.abs(anterior)) * 100
  }
  return { atual, anterior, variacao, unidade }
}


function resumirFechados(linhas: Array<{ status: string; valor: string | null }>) {
  const ganhos = linhas.filter((l) => l.status === 'ganho')
  const valor = somarValores(ganhos)
  return {
    valor,
    count: ganhos.length,
    
    
    
    conversao: linhas.length > 0 ? (ganhos.length / linhas.length) * 100 : 0,
    ticket: ganhos.length > 0 ? valor / ganhos.length : 0,
  }
}


export async function kpis(
  cliente: SupabaseClient,
  workspaceId: string,
  agora: Date = new Date(),
  dias: PeriodoDias = 30,
): Promise<Kpis> {
  const { iniA, iniB, fimB } = janelas(agora, dias)

  
  const { count: abertos, error: e1 } = await cliente
    .from('negocios')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'aberto')
  if (e1) throw e1

  
  const { data: valoresAbertos, error: e2 } = await cliente
    .from('negocios')
    .select('valor')
    .eq('workspace_id', workspaceId)
    .eq('status', 'aberto')
  if (e2) throw e2

  
  const { data: atual, error: e3 } = await cliente
    .from('negocios')
    .select('status, valor')
    .eq('workspace_id', workspaceId)
    .in('status', ['ganho', 'perdido'])
    .gte('fechado_em', iniA)
  if (e3) throw e3

  
  const { data: anterior, error: e4 } = await cliente
    .from('negocios')
    .select('status, valor')
    .eq('workspace_id', workspaceId)
    .in('status', ['ganho', 'perdido'])
    .gte('fechado_em', iniB)
    .lt('fechado_em', fimB)
  if (e4) throw e4

  const a = resumirFechados((atual as Array<{ status: string; valor: string | null }> | null) ?? [])
  const b = resumirFechados((anterior as Array<{ status: string; valor: string | null }> | null) ?? [])

  return {
    negociosAbertos: abertos ?? 0,
    valorEmAberto: somarValores((valoresAbertos as Array<{ valor: string | null }> | null) ?? []),
    ganhos: fluxo(a.valor, b.valor),
    ganhosCount: a.count,
    conversao: fluxo(a.conversao, b.conversao, 'pp'),
    ticketMedio: fluxo(a.ticket, b.ticket),
  }
}




export type SerieDia = (number | null)[]

export type SeriesKpi = {
  
  valorEmAberto: SerieDia
  
  ganhos: SerieDia
  
  conversao: SerieDia
}


type LinhaSerie = {
  status: string
  valor: string | null
  criado_em: string
  fechado_em: string | null
}


export function cortesDaSerie(agora: Date, dias: number): number[] {
  const fim = agora.getTime()
  return Array.from({ length: dias + 1 }, (_, i) => fim - (dias - i) * DIA_MS)
}


export function reconstruirSeries(linhas: LinhaSerie[], agora: Date, dias: number): SeriesKpi {
  const cortes = cortesDaSerie(agora, dias)
  const inicio = cortes[0]

  
  const negs = linhas.map((l) => ({
    aberto: l.status === 'aberto',
    ganho: l.status === 'ganho',
    decidido: l.status === 'ganho' || l.status === 'perdido',
    valor: Number(l.valor ?? 0),
    criado: new Date(l.criado_em).getTime(),
    fechado: l.fechado_em == null ? null : new Date(l.fechado_em).getTime(),
  }))

  const valorEmAberto: SerieDia = []
  const ganhos: SerieDia = []
  const conversao: SerieDia = []

  for (const t of cortes) {
    let estoque = 0
    let ganhoAcum = 0
    let ganhosN = 0
    let decididosN = 0

    for (const n of negs) {
      if (n.criado > t) continue 

      
      
      
      if (n.fechado == null ? n.aberto : n.fechado > t) estoque += n.valor

      
      if (n.fechado != null && n.decidido && n.fechado >= inicio && n.fechado <= t) {
        decididosN++
        if (n.ganho) {
          ganhosN++
          ganhoAcum += n.valor
        }
      }
    }

    valorEmAberto.push(estoque)
    ganhos.push(ganhoAcum)
    
    
    
    conversao.push(decididosN === 0 ? null : (ganhosN / decididosN) * 100)
  }

  return { valorEmAberto, ganhos, conversao }
}


export async function seriesKpi(
  cliente: SupabaseClient,
  workspaceId: string,
  agora: Date = new Date(),
  dias: PeriodoDias = 30,
): Promise<SeriesKpi> {
  const { iniA } = janelas(agora, dias)
  const { data, error } = await cliente
    .from('negocios')
    .select('status, valor, criado_em, fechado_em')
    .eq('workspace_id', workspaceId)
    .or(`fechado_em.is.null,fechado_em.gte.${iniA}`)
  if (error) throw error
  return reconstruirSeries((data as LinhaSerie[] | null) ?? [], agora, dias)
}


export async function negociosPrevistos(
  cliente: SupabaseClient,
  workspaceId: string,
  dias = 7,
  agora: Date = new Date(),
  limite = 5,
): Promise<NegocioPrevisto[]> {
  const ate = new Date(agora.getTime() + dias * DIA_MS).toISOString().slice(0, 10)
  const { data, error } = await cliente
    .from('negocios')
    .select('id, titulo, valor, etapa_id, previsao_fechamento, contatos(nome), empresas(nome)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'aberto')
    .not('previsao_fechamento', 'is', null)
    .lte('previsao_fechamento', ate)
    .order('previsao_fechamento', { ascending: true })
    .limit(limite)
  if (error) throw error

  return ((data as Array<{
    id: string; titulo: string; valor: string | null; etapa_id: string; previsao_fechamento: string
    contatos?: unknown; empresas?: unknown
  }> | null) ?? []).map((n) => ({
    id: n.id,
    titulo: n.titulo,
    valor: Number(n.valor ?? 0),
    etapaId: n.etapa_id,
    pessoa: quemEmbed(n.contatos, n.empresas),
    previsao: n.previsao_fechamento,
    
    
    
    
    diasAte: diasAtePrevisao(n.previsao_fechamento, agora),
  }))
}


export function semOsParados<T extends { id: string }>(
  previstos: T[],
  parados: { id: string }[],
): T[] {
  const jaNaOutraLista = new Set(parados.map((p) => p.id))
  return previstos.filter((n) => !jaNaOutraLista.has(n.id))
}


export async function negociosParados(
  cliente: SupabaseClient,
  workspaceId: string,
  dias = 14,
  agora: Date = new Date(),
  limite = 5,
): Promise<{ itens: NegocioParado[]; total: number }> {
  const corte = new Date(agora.getTime() - dias * DIA_MS).toISOString()
  const { data, error, count } = await cliente
    .from('negocios')
    .select('id, titulo, valor, etapa_id, etapa_desde, contatos(nome), empresas(nome)', {
      count: 'exact',
    })
    .eq('workspace_id', workspaceId)
    .eq('status', 'aberto')
    .lt('etapa_desde', corte)
    .order('etapa_desde', { ascending: true })
    .limit(limite)
  if (error) throw error

  const linhas = (data as Array<{
    id: string; titulo: string; valor: string | null; etapa_id: string; etapa_desde: string
    contatos?: unknown; empresas?: unknown
  }> | null) ?? []

  const itens = linhas.map((n) => ({
    id: n.id,
    titulo: n.titulo,
    valor: Number(n.valor ?? 0),
    etapaId: n.etapa_id,
    pessoa: quemEmbed(n.contatos, n.empresas),
    diasParado: Math.floor((agora.getTime() - new Date(n.etapa_desde).getTime()) / DIA_MS),
  }))
  
  
  return { itens, total: count ?? itens.length }
}


export async function negociosPorEtapa(
  cliente: SupabaseClient,
  workspaceId: string,
): Promise<EtapaMetrica[]> {
  
  const { data: pipeline, error: ePipe } = await cliente
    .from('pipelines')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('is_padrao', true)
    .maybeSingle()
  if (ePipe) throw ePipe
  const pipe = pipeline as { id: string } | null
  if (!pipe) return []

  
  const { data: etapas, error: eEtapas } = await cliente
    .from('etapas')
    .select('id, nome, cor, ordem')
    .eq('workspace_id', workspaceId)
    .eq('pipeline_id', pipe.id)
    .order('ordem')
  if (eEtapas) throw eEtapas
  const linhasEtapas = (etapas as Array<{ id: string; nome: string; cor: string | null }> | null) ?? []

  
  const { data: negocios, error: eNeg } = await cliente
    .from('negocios')
    .select('etapa_id, valor')
    .eq('workspace_id', workspaceId)
    .eq('status', 'aberto')
  if (eNeg) throw eNeg
  const linhasNeg = (negocios as Array<{ etapa_id: string; valor: string | null }> | null) ?? []

  const contagem = new Map<string, number>()
  const soma = new Map<string, number>()
  for (const n of linhasNeg) {
    contagem.set(n.etapa_id, (contagem.get(n.etapa_id) ?? 0) + 1)
    soma.set(n.etapa_id, (soma.get(n.etapa_id) ?? 0) + Number(n.valor ?? 0))
  }

  
  return linhasEtapas.map((e) => ({
    etapaId: e.id,
    nome: e.nome,
    cor: e.cor,
    count: contagem.get(e.id) ?? 0,
    valor: soma.get(e.id) ?? 0,
  }))
}


