

import type { OpcaoCampo } from '@/lib/campos-valor'

const MS_DIA = 86_400_000




export type EtapaRelatorio = { id: string; nome: string; ordem: number }


export type LinhaHistorico = {
  negocio_id: string
  etapa_id: string
  entrou_em: string
  saiu_em: string | null
  
  aproximado?: boolean
}


export type ValorMonetario = string | number | null


export type LinhaForecast = { valor: ValorMonetario; probabilidade: number | null }


export type LinhaPivot = { campos: Record<string, unknown> | null; valor: ValorMonetario }



export type LinhaConversao = {
  etapa_id: string
  nome: string
  
  entraram: number
  
  chegaramSeguinte: number | null
  
  taxaSeguinte: number | null
}

export type LinhaTempo = {
  etapa_id: string
  
  nome: string | null
  mediaDias: number | null
  medianaDias: number | null
  
  amostra: number
}

export type ResultadoForecast = {
  
  total: string
  
  considerados: number
  
  semProbabilidade: number
  
  semValor: number
}

export type GrupoPivot = {
  
  chave: string | null
  
  rotulo: string
  contagem: number
  
  soma: string
}


export const ROTULO_VAZIO = '(não preenchido)'




function instante(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : NaN
}


function porcentagem(parte: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((parte / total) * 1000) / 10
}


function arredondar1(n: number): number {
  return Math.round(n * 10) / 10
}



const RE_DECIMAL = /^-?\d+(\.\d+)?$/


function paraCentavos(v: ValorMonetario | undefined): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && !Number.isFinite(v)) return null
  const s = (typeof v === 'number' ? String(v) : v).trim()
  if (!RE_DECIMAL.test(s)) return null
  const negativo = s.startsWith('-')
  const [inteiro, decimal = ''] = (negativo ? s.slice(1) : s).split('.')
  const centavos = Number(inteiro) * 100 + Number((decimal + '00').slice(0, 2))
  return negativo ? -centavos : centavos
}


function deCentavos(centavos: number): string {
  const negativo = centavos < 0
  const abs = Math.abs(Math.trunc(centavos))
  return `${negativo ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}




function primeirasEntradas(linhas: LinhaHistorico[]): Map<string, Map<string, number>> {
  const porEtapa = new Map<string, Map<string, number>>()
  for (const l of linhas) {
    let mapa = porEtapa.get(l.etapa_id)
    if (!mapa) { mapa = new Map(); porEtapa.set(l.etapa_id, mapa) }
    const t = instante(l.entrou_em)
    const atual = mapa.get(l.negocio_id)
    if (atual === undefined || Number.isNaN(atual)) mapa.set(l.negocio_id, t)
    else if (!Number.isNaN(t)) mapa.set(l.negocio_id, Math.min(atual, t))
  }
  return porEtapa
}

const SEM_ENTRADAS: ReadonlyMap<string, number> = new Map()


function avancou(tAtual: number, tSeguinte: number): boolean {
  if (Number.isNaN(tAtual) || Number.isNaN(tSeguinte)) return true
  return tSeguinte >= tAtual
}


export function conversaoPorEtapa(
  linhas: LinhaHistorico[],
  etapas: EtapaRelatorio[],
): LinhaConversao[] {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem)   
  const porEtapa = primeirasEntradas(linhas)

  return ordenadas.map((etapa, i) => {
    const entradas = porEtapa.get(etapa.id) ?? SEM_ENTRADAS
    const entraram = entradas.size
    const seguinte = ordenadas[i + 1]

    
    
    if (!seguinte) {
      return { etapa_id: etapa.id, nome: etapa.nome, entraram, chegaramSeguinte: null, taxaSeguinte: null }
    }

    const depois = porEtapa.get(seguinte.id) ?? SEM_ENTRADAS
    let chegaram = 0
    for (const [negocio, t] of entradas) {
      const tSeguinte = depois.get(negocio)
      if (tSeguinte !== undefined && avancou(t, tSeguinte)) chegaram++
    }
    return {
      etapa_id: etapa.id,
      nome: etapa.nome,
      entraram,
      chegaramSeguinte: chegaram,
      
      taxaSeguinte: porcentagem(chegaram, entraram),
    }
  })
}




export function mediana(ns: number[]): number | null {
  if (ns.length === 0) return null
  const ordenados = [...ns].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 1
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2
}


export function tempoPorEtapa(
  linhas: LinhaHistorico[],
  agora: Date,
  etapas?: EtapaRelatorio[],
): LinhaTempo[] {
  const duracoes = new Map<string, number[]>()
  const ordemVista: string[] = []
  const tAgora = agora.getTime()

  for (const l of linhas) {
    const inicio = instante(l.entrou_em)
    const fim = l.saiu_em === null ? tAgora : instante(l.saiu_em)
    
    if (Number.isNaN(inicio) || Number.isNaN(fim)) continue
    let lista = duracoes.get(l.etapa_id)
    if (!lista) { lista = []; duracoes.set(l.etapa_id, lista); ordemVista.push(l.etapa_id) }
    
    
    lista.push(Math.max(0, (fim - inicio) / MS_DIA))
  }

  const alvo: Array<{ id: string; nome: string | null }> = etapas
    ? [...etapas].sort((a, b) => a.ordem - b.ordem).map((e) => ({ id: e.id, nome: e.nome }))
    : ordemVista.map((id) => ({ id, nome: null }))

  return alvo.map(({ id, nome }) => {
    const lista = duracoes.get(id) ?? []
    const n = lista.length
    if (n === 0) return { etapa_id: id, nome, mediaDias: null, medianaDias: null, amostra: 0 }
    const soma = lista.reduce((acc, d) => acc + d, 0)
    return {
      etapa_id: id,
      nome,
      mediaDias: arredondar1(soma / n),
      medianaDias: arredondar1(mediana(lista) as number),   
      amostra: n,
    }
  })
}




export function forecast(linhas: LinhaForecast[]): ResultadoForecast {
  let centavos = 0
  let considerados = 0
  let semProbabilidade = 0
  let semValor = 0

  for (const l of linhas) {
    const valor = paraCentavos(l.valor)
    if (valor === null) { semValor++; continue }
    considerados++
    const p = l.probabilidade
    if (p === null || p === undefined || !Number.isFinite(p)) { semProbabilidade++; continue }
    const prob = Math.min(100, Math.max(0, p))
    centavos += Math.round((valor * prob) / 100)
  }

  return { total: deCentavos(centavos), considerados, semProbabilidade, semValor }
}




function chavesDe(bruto: unknown): Array<string | null> {
  if (bruto === null || bruto === undefined || bruto === '') return [null]
  if (Array.isArray(bruto)) {
    
    
    const itens = new Set<string>()
    for (const item of bruto) {
      if (typeof item === 'string' && item !== '') itens.add(item)
      else if (typeof item === 'number' || typeof item === 'boolean') itens.add(String(item))
    }
    return itens.size === 0 ? [null] : [...itens]
  }
  if (typeof bruto === 'string' || typeof bruto === 'number' || typeof bruto === 'boolean') {
    return [String(bruto)]
  }
  return [null]
}


export function pivot(linhas: LinhaPivot[], slug: string, opcoes?: OpcaoCampo[]): GrupoPivot[] {
  const baldes = new Map<string | null, { contagem: number; centavos: number }>()

  for (const l of linhas) {
    
    
    const centavos = paraCentavos(l.valor) ?? 0
    for (const chave of chavesDe(l.campos?.[slug])) {
      const balde = baldes.get(chave) ?? { contagem: 0, centavos: 0 }
      balde.contagem++
      balde.centavos += centavos
      baldes.set(chave, balde)
    }
  }

  const porId = new Map((opcoes ?? []).map((o) => [o.id, o.rotulo]))

  return [...baldes.entries()]
    .map(([chave, b]) => ({
      chave,
      rotulo: chave === null ? ROTULO_VAZIO : (porId.get(chave) ?? chave),
      contagem: b.contagem,
      centavos: b.centavos,
    }))
    .sort((a, b) => {
      if (a.chave === null) return 1
      if (b.chave === null) return -1
      return b.contagem - a.contagem || b.centavos - a.centavos || a.rotulo.localeCompare(b.rotulo, 'pt-BR')
    })
    
    
    .map(({ chave, rotulo, contagem, centavos }) => ({ chave, rotulo, contagem, soma: deCentavos(centavos) }))
}








export const TIPOS_RELATORIO = ['funil_conversao', 'tempo_por_etapa', 'forecast', 'tabela'] as const
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number]


export const ROTULO_TIPO: Record<TipoRelatorio, string> = {
  funil_conversao: 'Funil de conversão',
  tempo_por_etapa: 'Tempo por etapa',
  forecast: 'Previsão de fechamento',
  tabela: 'Tabela por campo',
}

export function ehTipoRelatorio(x: unknown): x is TipoRelatorio {
  return typeof x === 'string' && (TIPOS_RELATORIO as readonly string[]).includes(x)
}

export type StatusFiltro = 'todos' | 'aberto' | 'ganho' | 'perdido'
const STATUS_FILTRO: StatusFiltro[] = ['todos', 'aberto', 'ganho', 'perdido']

export const ROTULO_STATUS: Record<StatusFiltro, string> = {
  todos: 'Todos', aberto: 'Aberto', ganho: 'Ganho', perdido: 'Perdido',
}


export const AGRUP_ETAPA = '@etapa'
export const AGRUP_STATUS = '@status'
export const AGRUPAMENTOS_FIXOS: Array<{ slug: string; rotulo: string }> = [
  { slug: AGRUP_ETAPA, rotulo: 'Etapa' },
  { slug: AGRUP_STATUS, rotulo: 'Situação' },
]


export type ConfigRelatorio = {
  funilId: string | null
  
  de: string | null
  ate: string | null
  status: StatusFiltro
  
  agrupamento: string | null
}

export const CONFIG_VAZIA: ConfigRelatorio = {
  funilId: null, de: null, ate: null, status: 'todos', agrupamento: null,
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/
const RE_AGRUP = /^@?[a-z0-9_]{1,64}$/

function texto(bruto: unknown): string | null {
  return typeof bruto === 'string' && bruto.trim() !== '' ? bruto.trim() : null
}


export function limparConfig(bruto: unknown): ConfigRelatorio {
  const o = (bruto ?? {}) as Record<string, unknown>
  const funilId = texto(o.funilId)
  const de = texto(o.de)
  const ate = texto(o.ate)
  const status = texto(o.status)
  const agrupamento = texto(o.agrupamento)
  return {
    funilId: funilId && RE_UUID.test(funilId) ? funilId : null,
    de: de && RE_DATA.test(de) ? de : null,
    ate: ate && RE_DATA.test(ate) ? ate : null,
    status: status && (STATUS_FILTRO as string[]).includes(status) ? (status as StatusFiltro) : 'todos',
    agrupamento: agrupamento && RE_AGRUP.test(agrupamento) ? agrupamento : null,
  }
}


export function paramsDeConfig(tipo: TipoRelatorio, config: ConfigRelatorio): URLSearchParams {
  const p = new URLSearchParams({ tipo })
  if (config.funilId) p.set('funil', config.funilId)
  if (config.de) p.set('de', config.de)
  if (config.ate) p.set('ate', config.ate)
  if (config.status !== 'todos') p.set('status', config.status)
  if (config.agrupamento) p.set('agrupamento', config.agrupamento)
  return p
}


export function configDeParams(sp: Record<string, string | string[] | undefined>): ConfigRelatorio {
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return limparConfig({
    funilId: um(sp.funil), de: um(sp.de), ate: um(sp.ate),
    status: um(sp.status), agrupamento: um(sp.agrupamento),
  })
}



export type FunilInfo = { id: string; nome: string }
export type Periodo = { de: string | null; ate: string | null }


export type Aviso = {
  
  truncado: boolean
  teto: number
  
  aproximados: number
  
  corte: string | null
}

export type AgrupamentoInfo = {
  slug: string
  
  rotulo: string
  
  multipla: boolean
}

type Base = { funil: FunilInfo | null; periodo: Periodo; aviso: Aviso }

export type ResultadoRelatorio =
  | (Base & { tipo: 'funil_conversao'; linhas: LinhaConversao[] })
  | (Base & { tipo: 'tempo_por_etapa'; linhas: LinhaTempo[] })
  | (Base & { tipo: 'forecast'; resultado: ResultadoForecast })
  | (Base & { tipo: 'tabela'; grupos: GrupoPivot[]; agrupamento: AgrupamentoInfo; totalNegocios: number })




export function decimalBR(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v).replace('.', ',')
}


export function barra(valor: number, maximo: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(maximo) || maximo <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((valor / maximo) * 100)))
}


export function nomeArquivoCsv(nome: string): string {
  const base = (nome ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60)
  return base || 'relatorio'
}


export function linhasExport(r: ResultadoRelatorio): string[][] {
  switch (r.tipo) {
    case 'funil_conversao':
      return [
        ['Etapa', 'Entraram', 'Chegaram à seguinte', 'Conversão (%)'],
        ...r.linhas.map((l) => [
          l.nome,
          String(l.entraram),
          l.chegaramSeguinte === null ? '' : String(l.chegaramSeguinte),
          decimalBR(l.taxaSeguinte),
        ]),
      ]
    case 'tempo_por_etapa':
      return [
        ['Etapa', 'Média (dias)', 'Mediana (dias)', 'Amostra'],
        ...r.linhas.map((l) => [
          l.nome ?? '',
          decimalBR(l.mediaDias),
          decimalBR(l.medianaDias),
          String(l.amostra),
        ]),
      ]
    case 'forecast':
      return [
        ['Previsão (R$)', 'Negócios considerados', 'Sem probabilidade', 'Sem valor'],
        [
          decimalBR(r.resultado.total),
          String(r.resultado.considerados),
          String(r.resultado.semProbabilidade),
          String(r.resultado.semValor),
        ],
      ]
    case 'tabela':
      return [
        [r.agrupamento.rotulo, 'Negócios', 'Soma (R$)'],
        ...r.grupos.map((g) => [g.rotulo, String(g.contagem), decimalBR(g.soma)]),
      ]
  }
}
