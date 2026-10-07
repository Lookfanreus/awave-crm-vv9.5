

















import 'server-only'
import { admin } from '@/server/supabase'
import { detalheSeguro } from '@/lib/sanitizar-erro'


export const PRECOS: Record<
  string,
  { entradaPor1M: number; saidaPor1M: number; tipo: 'chat' | 'embedding' }
> = {
  'gpt-5.5': { entradaPor1M: 5.0, saidaPor1M: 30.0, tipo: 'chat' },
  'gpt-5.1': { entradaPor1M: 1.25, saidaPor1M: 10.0, tipo: 'chat' },
  'gpt-5-mini': { entradaPor1M: 0.25, saidaPor1M: 2.0, tipo: 'chat' },
  'gpt-4.1': { entradaPor1M: 2.0, saidaPor1M: 8.0, tipo: 'chat' },
  
  'text-embedding-3-small': { entradaPor1M: 0.02, saidaPor1M: 0, tipo: 'embedding' },
  'text-embedding-3-large': { entradaPor1M: 0.13, saidaPor1M: 0, tipo: 'embedding' },
}


const NOMES_POR_TAMANHO = Object.keys(PRECOS).sort((a, b) => b.length - a.length)


function precoDe(modelo: string | null | undefined) {
  if (!modelo) return undefined
  const nome = NOMES_POR_TAMANHO.find((k) => modelo === k || modelo.startsWith(k))
  return nome ? PRECOS[nome] : undefined
}


export function temPrecoConhecido(modelo: string | null | undefined): boolean {
  return precoDe(modelo) !== undefined
}


export function custoUsd(
  modelo: string,
  entrada: number | null,
  saida: number | null,
): number | null {
  if (entrada === null || saida === null) return null
  if (!Number.isFinite(entrada) || !Number.isFinite(saida)) return null
  const preco = precoDe(modelo)
  if (!preco) return null
  return (entrada / 1e6) * preco.entradaPor1M + (saida / 1e6) * preco.saidaPor1M
}

export async function registrarCusto(entrada: {
  workspaceId: string
  conversaId: string | null
  modelo: string
  
  tokensEntrada: number | null
  tokensSaida: number | null
}): Promise<void> {
  try {
    const { error } = await admin()
      .from('custos_ia')
      .insert({
        workspace_id: entrada.workspaceId,
        conversa_id: entrada.conversaId,
        modelo: entrada.modelo,
        
        
        
        tokens_entrada: entrada.tokensEntrada ?? 0,
        tokens_saida: entrada.tokensSaida ?? 0,
        custo_usd: custoUsd(entrada.modelo, entrada.tokensEntrada, entrada.tokensSaida),
      })
    
    
    if (error) {
      console.warn('[agente/custo] registro nao gravado:', detalheSeguro(error))
    }
  } catch (err) {
    
    
    
    console.warn('[agente/custo] registro estourou (engolido de proposito):', detalheSeguro(err))
  }
}




export type GrupoDeCusto = {
  workspace_id: string
  
  modelo: string | null
  
  linhas: number | string | null
  
  sem_preco: number | string | null
  tokens_entrada: number | string | null
  tokens_saida: number | string | null
  
  custo_usd: number | string | null
  
  grupos?: number | string | null
}

export type FatiaDeCusto = {
  workspaceId: string
  nome: string
  rodadas: number
  tokensEntrada: number
  tokensSaida: number
  usd: number
  
  parcial: boolean
}

export type ResumoDeCusto = {
  desde: string
  
  rodadas: number | null
  tokensEntrada: number | null
  tokensSaida: number | null
  
  usd: number | null
  
  parcial: boolean
  
  parcialPorModelo: boolean
  
  parcialPorContagem: boolean
  
  porWorkspace: FatiaDeCusto[] | null
}


export function inicioDoMes(agoraMs: number): string {
  const d = new Date(agoraMs)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

function numero(x: unknown): number {
  const n = typeof x === 'string' ? Number(x) : typeof x === 'number' ? x : Number.NaN
  return Number.isFinite(n) ? n : 0
}


function numeroOuNada(x: unknown): number | null {
  if (x === null || x === undefined) return null
  const n = typeof x === 'string' ? Number(x) : typeof x === 'number' ? x : Number.NaN
  return Number.isFinite(n) ? n : null
}


export function custoNaoLido(desde: string): ResumoDeCusto {
  return {
    desde,
    rodadas: null,
    tokensEntrada: null,
    tokensSaida: null,
    usd: null,
    parcial: true,
    
    
    
    parcialPorModelo: false,
    parcialPorContagem: false,
    porWorkspace: null,
  }
}


const SEM_NOME_REMOVIDO = 'espaço removido'
const SEM_NOME_NAO_LIDO = 'nome não lido'


export function resumirCusto(
  grupos: GrupoDeCusto[],
  nomes: Map<string, string> | null,
  desde: string,
): ResumoDeCusto {
  const por = new Map<string, FatiaDeCusto>()
  const total: ResumoDeCusto = {
    desde,
    rodadas: 0,
    tokensEntrada: 0,
    tokensSaida: 0,
    usd: 0,
    parcial: false,
    parcialPorModelo: false,
    parcialPorContagem: false,
    porWorkspace: [],
  }

  for (const g of grupos) {
    const linhas = numero(g.linhas)
    const semPreco = numero(g.sem_preco)
    const entrada = numero(g.tokens_entrada)
    const saida = numero(g.tokens_saida)
    const usd = numero(g.custo_usd)

    
    
    
    
    
    const preco = precoDe(g.modelo)
    const ehEmbedding = preco?.tipo === 'embedding'
    const rodadas = ehEmbedding ? 0 : linhas

    total.rodadas! += rodadas
    total.tokensEntrada! += entrada
    total.tokensSaida! += saida
    total.usd! += usd
    
    
    
    
    if (semPreco > 0) {
      total.parcial = true
      if (preco) total.parcialPorContagem = true
      else total.parcialPorModelo = true
    }

    const atual =
      por.get(g.workspace_id) ??
      {
        workspaceId: g.workspace_id,
        
        
        nome: nomes ? (nomes.get(g.workspace_id) ?? SEM_NOME_REMOVIDO) : SEM_NOME_NAO_LIDO,
        rodadas: 0,
        tokensEntrada: 0,
        tokensSaida: 0,
        usd: 0,
        parcial: false,
      }
    
    
    atual.rodadas += rodadas
    atual.tokensEntrada += entrada
    atual.tokensSaida += saida
    atual.usd += usd
    if (semPreco > 0) atual.parcial = true
    por.set(g.workspace_id, atual)
  }

  
  
  
  total.porWorkspace = [...por.values()].sort((a, b) => b.usd - a.usd || b.rodadas - a.rodadas)
  return total
}


export async function lerCustoDoDeploy(agoraMs: number = Date.now()): Promise<ResumoDeCusto> {
  const { ehDonoDoDeploy } = await import('@/server/auth/dono-deploy')
  if (!(await ehDonoDoDeploy())) {
    throw new Error('somente quem instalou este CRM enxerga o gasto do servidor inteiro')
  }

  const desde = inicioDoMes(agoraMs)

  
  
  const { data, error } = await admin().rpc('custo_do_deploy', { p_desde: desde })
  
  
  
  
  if (error || !Array.isArray(data)) return custoNaoLido(desde)

  const grupos = data as GrupoDeCusto[]
  if (grupos.length > 0) {
    
    
    
    const declarados = numeroOuNada(grupos[0].grupos)
    if (declarados === null || grupos.length < declarados) return custoNaoLido(desde)
  }

  const ids = [...new Set(grupos.map((g) => g.workspace_id))]
  
  
  
  let nomes: Map<string, string> | null = null
  if (ids.length > 0) {
    
    
    
    const { data: ws, error: erroNomes } = await admin()
      .from('workspaces')
      .select('id, nome')
      .in('id', ids)
    
    
    
    if (!erroNomes && ws) {
      nomes = new Map()
      for (const w of ws as Array<{ id: string; nome: string | null }>) {
        if (w.nome) nomes.set(w.id, w.nome)
      }
    }
  } else {
    
    nomes = new Map()
  }

  return resumirCusto(grupos, nomes, desde)
}
