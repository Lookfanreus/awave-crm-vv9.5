





















import 'server-only'
import { criarOrcamento, type Orcamento } from '@/lib/orcamento-tick'
import { admin } from '@/server/supabase'
import { copyDoNome } from '@/lib/canais/nome-do-perfil'
import { lerCredenciais } from '@/server/canais/segredos'
import { limparTexto, LIMITE_NOME } from '@/server/canais/providers/fronteira'
import { GRAPH_BASE } from '@/server/canais/providers/instagram'
import { SLUG_INSTAGRAM } from '@/server/canais/types'
import type { HttpDeps } from '@/server/canais/types'


export const TETO_POR_TICK = 5


export const TETO_TENTATIVAS = 3


export const TIMEOUT_MS = 20_000


export const RESERVA_MS = TETO_POR_TICK * TIMEOUT_MS * 3


const ID_DA_PESSOA = /^\d+$/


const CAMPOS = 'name,username'


type LinhaPendente = {
  id: string
  workspace_id: string
  nome: string | null
  identidade_canal: string | null
  identidade_externa: string | null
  perfil_tentativas: number | null
}


type CanalDoContato = {
  id: string
  provider: string
  serverUrl: string
  externalId: string | null
}


type Desfecho =
  | { tag: 'resolvida'; nome: string }
  | { tag: 'adiada'; tentativas: number }
  | { tag: 'sem_credencial' }
  
  | { tag: 'sem_canal' }
  | { tag: 'desistiu'; tentativas: number }


function umEmbed<T>(x: unknown): T | null {
  if (!x) return null
  return (Array.isArray(x) ? x[0] : x) as T
}


function canalDoContato(
  linha: LinhaPendente,
  vinculos: Array<{ contato_id: string | null; workspace_id: string; canais?: unknown }>,
): CanalDoContato | null {
  const namespace = (linha.identidade_canal ?? '').trim()
  if (!namespace) return null

  for (const v of vinculos) {
    if (v.contato_id !== linha.id) continue
    if (v.workspace_id !== linha.workspace_id) continue
    const canal = umEmbed<{
      id: string
      provider: string
      external_id: string | null
      config: { server_url?: string } | null
    }>(v.canais)
    if (!canal) continue
    if (canal.provider !== SLUG_INSTAGRAM) continue
    if ((canal.external_id ?? '') !== namespace) continue
    return {
      id: canal.id,
      provider: canal.provider,
      serverUrl: canal.config?.server_url ?? '',
      externalId: canal.external_id,
    }
  }
  return null
}


function nomeDaResposta(corpo: unknown): string {
  if (!corpo || typeof corpo !== 'object') return ''
  const c = corpo as { name?: unknown; username?: unknown }
  const nome = limparTexto(c.name, LIMITE_NOME).trim()
  if (nome) return nome
  
  return limparTexto(c.username, LIMITE_NOME).trim()
}


async function processar(
  linha: LinhaPendente,
  canal: CanalDoContato | null,
  
  temConversa: boolean,
  http: typeof fetch,
): Promise<Desfecho> {
  const tentativas = (linha.perfil_tentativas ?? 0) + 1
  
  const falha = (): Desfecho =>
    tentativas >= TETO_TENTATIVAS ? { tag: 'desistiu', tentativas } : { tag: 'adiada', tentativas }
  
  const terminal = (): Desfecho => ({ tag: 'desistiu', tentativas: linha.perfil_tentativas ?? 0 })

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (!canal) return temConversa ? terminal() : { tag: 'sem_canal' }

  const identidade = (linha.identidade_externa ?? '').trim()
  
  
  if (!identidade || !ID_DA_PESSOA.test(identidade)) return terminal()

  const r = await lerCredenciais(canal)
  
  if (!r.creds) return { tag: 'sem_credencial' }
  
  
  
  if (r.creds.tipo !== SLUG_INSTAGRAM) return terminal()

  let resposta: Response
  try {
    
    
    
    resposta = await http(`${GRAPH_BASE}/${identidade}?fields=${CAMPOS}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${r.creds.accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    
    
    
    
    
    return falha()
  }

  
  
  if (!resposta.ok) return falha()

  let nome = ''
  try {
    nome = nomeDaResposta(await resposta.json())
  } catch {
    
    return falha()
  }

  
  
  if (!nome) return falha()
  return { tag: 'resolvida', nome }
}


async function soltarReserva(linhas: LinhaPendente[]): Promise<void> {
  for (const linha of linhas) {
    const { error } = await admin()
      .from('contatos')
      .update({ perfil_reservado_ate: null })
      .eq('workspace_id', linha.workspace_id)
      .eq('id', linha.id)
    if (error) console.warn('[perfil] reserva nao devolvida a fila')
  }
}


export async function drenarPerfis(
  orcamento: Orcamento = criarOrcamento(Date.now()),
  deps: HttpDeps = {},
): Promise<{
  resolvidos: number
  adiados: number
  semCredencial: number
  desistidos: number
}> {
  const vazio = { resolvidos: 0, adiados: 0, semCredencial: 0, desistidos: 0 }

  
  
  
  
  
  
  if (!orcamento.cabe('perfis')) return vazio

  const { data: reservadas, error: erroReserva } = await admin().rpc('reservar_perfis', {
    p_limite: TETO_POR_TICK,
    p_reserva: `${RESERVA_MS} milliseconds`,
  })
  if (erroReserva) throw erroReserva

  const linhas = (reservadas ?? []) as LinhaPendente[]
  
  
  if (linhas.length === 0) return vazio

  
  
  
  const { data: vinculos, error } = await admin()
    .from('conversas')
    .select('contato_id, workspace_id, canais!inner(id, provider, external_id, config)')
    .in(
      'contato_id',
      linhas.map((l) => l.id),
    )
  
  
  
  if (error) throw error

  const ligacoes = (vinculos ?? []) as Array<{
    contato_id: string | null
    workspace_id: string
    canais?: unknown
  }>
  const http = deps.fetchFn ?? fetch

  let resolvidos = 0
  let adiados = 0
  let semCredencial = 0
  let desistidos = 0

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    
    
    
    
    if (!orcamento.cabe('perfis')) {
      await soltarReserva(linhas.slice(i))
      adiados += linhas.length - i
      break
    }

    let d: Desfecho
    try {
      d = await processar(
        linha,
        canalDoContato(linha, ligacoes),
        ligacoes.some((v) => v.contato_id === linha.id),
        http,
      )
    } catch {
      
      
      
      const tentativas = (linha.perfil_tentativas ?? 0) + 1
      d =
        tentativas >= TETO_TENTATIVAS
          ? { tag: 'desistiu', tentativas }
          : { tag: 'adiada', tentativas }
    }

    
    
    
    
    let dados: Record<string, unknown>
    if (d.tag === 'resolvida') {
      resolvidos++
      dados = { nome: d.nome, perfil_pendente: false, perfil_reservado_ate: null }
    } else if (d.tag === 'adiada') {
      adiados++
      dados = { perfil_tentativas: d.tentativas }
    } else if (d.tag === 'sem_credencial' || d.tag === 'sem_canal') {
      semCredencial++
      
      continue
    } else {
      desistidos++
      
      
      
      
      
      console.warn('[perfil]', copyDoNome('sem_nome'))
      
      
      
      dados = { perfil_pendente: false, perfil_tentativas: d.tentativas, perfil_reservado_ate: null }
    }

    await admin()
      .from('contatos')
      .update(dados)
      .eq('workspace_id', linha.workspace_id)
      .eq('id', linha.id)
  }

  return { resolvidos, adiados, semCredencial, desistidos }
}
