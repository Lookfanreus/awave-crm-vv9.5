








import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PROVIDER_DE_SIMULACAO } from '@/lib/canais/simulacao'




import { PAGINA_CONVERSAS as PAGINA, PAGINA_MENSAGENS as MENSAGENS } from '@/lib/canais/paginacao-inbox'




import { statusDoFiltro, type FiltroDaInbox } from '@/lib/canais/filtro-inbox'
import { escaparCuringa } from '@/lib/canais/escapar-curinga'


export type MidiaLinha = {
  kind: 'imagem' | 'audio' | 'video' | 'documento'
  mime?: string
  refExterna: string
  legenda?: string
  status: 'pendente' | 'ok' | 'erro'
  caminho?: string
  
  tentativas?: number
  
  reservadaAte?: string
}

export type ConversaLista = {
  id: string
  contatoId: string | null
  
  contatoNome: string | null
  chaveExterna: string
  status: 'aberta' | 'arquivada' | 'assumida' | 'aguardando_humano'
  ultimaMensagemEm: string | null
  
  naoLidas: number
  atribuidaA: string | null
  
  assumidaEm: string | null
  
  provider: string
  
  perfilPendente: boolean | null
  
  identidadeExterna: string | null
  
  ultimaEntradaIso: string | null
}

export type MensagemThread = {
  id: string
  externoId: string | null
  direcao: 'entrada' | 'saida'
  autor: 'contato' | 'membro' | 'aparelho' | 'agente'
  texto: string
  midia: MidiaLinha | null
  status: string
  origemEm: string
  
  midiaUrl?: string | null
  
  ultimoErro: string | null
}


function umDoEmbed(x: unknown): Record<string, unknown> | undefined {
  if (!x) return undefined
  const o = Array.isArray(x) ? x[0] : x
  return o && typeof o === 'object' ? (o as Record<string, unknown>) : undefined
}

function nomeEmbed(x: unknown): string | null {
  const v = umDoEmbed(x)?.nome
  return typeof v === 'string' ? v : null
}


function textoEmbed(x: unknown, campo: string): string | null {
  const v = umDoEmbed(x)?.[campo]
  return typeof v === 'string' ? v : null
}

function boolEmbed(x: unknown, campo: string): boolean | null {
  const v = umDoEmbed(x)?.[campo]
  return typeof v === 'boolean' ? v : null
}


function providerEmbed(x: unknown): string {
  const v = umDoEmbed(x)?.provider
  return typeof v === 'string' ? v : ''
}


const COLUNAS_DA_LINHA =
  'id, contato_id, chave_externa, status, ultima_mensagem_em, ultima_msg_in_at, nao_lidas, atribuida_a, assumida_em'


const COLUNAS_DO_CONTATO = 'nome, perfil_pendente, identidade_externa'


function comoConversaLista(row: Record<string, unknown>): ConversaLista {
  return {
    id: row.id as string,
    contatoId: (row.contato_id as string | null) ?? null,
    contatoNome: nomeEmbed(row.contatos),
    perfilPendente: boolEmbed(row.contatos, 'perfil_pendente'),
    identidadeExterna: textoEmbed(row.contatos, 'identidade_externa'),
    chaveExterna: row.chave_externa as string,
    status: row.status as ConversaLista['status'],
    ultimaMensagemEm: (row.ultima_mensagem_em as string | null) ?? null,
    naoLidas: (row.nao_lidas as number) ?? 0,
    atribuidaA: (row.atribuida_a as string | null) ?? null,
    assumidaEm: (row.assumida_em as string | null) ?? null,
    provider: providerEmbed(row.canais),
    ultimaEntradaIso: (row.ultima_msg_in_at as string | null) ?? null,
  }
}


export async function lerConversa(
  cliente: SupabaseClient,
  ws: string,
  conversaId: string,
): Promise<ConversaLista | null> {
  const { data, error } = await cliente
    .from('conversas')
    .select(`${COLUNAS_DA_LINHA}, canais!inner(provider), contatos(${COLUNAS_DO_CONTATO})`)
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .neq('canais.provider', PROVIDER_DE_SIMULACAO)
    .maybeSingle()
  
  
  
  if (error) throw error
  return data ? comoConversaLista(data as Record<string, unknown>) : null
}

export async function listarConversas(
  cliente: SupabaseClient,
  ws: string,
  
  { pagina, busca, filtro }: { pagina: number; busca?: string; filtro?: FiltroDaInbox },
): Promise<ConversaLista[]> {
  
  
  
  
  
  
  
  
  const embed = busca
    ? `contatos!inner(${COLUNAS_DO_CONTATO})`
    : `contatos(${COLUNAS_DO_CONTATO})`

  
  
  
  
  
  
  
  
  
  
  
  let q = cliente
    .from('conversas')
    .select(
      
      
      
      
      `${COLUNAS_DA_LINHA}, canais!inner(provider), ${embed}`,
    )
    .eq('workspace_id', ws)
    .neq('canais.provider', PROVIDER_DE_SIMULACAO)
    
    
    
    
    
    
    
    
    
    
    
    .in('status', [...statusDoFiltro(filtro)])

  
  
  
  
  
  
  if (busca) q = q.ilike('contatos.nome', `%${escaparCuringa(busca)}%`)

  const { data, error } = await q
    
    .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
    
    
    
    
    
    
    
    
    
    
    
    .order('id', { ascending: false })
    .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)
  
  
  if (error) throw error

  
  return ((data ?? []) as Record<string, unknown>[]).map(comoConversaLista)
}

export async function lerThread(
  cliente: SupabaseClient,
  ws: string,
  conversaId: string,
  { antes }: { antes?: string } = {},
): Promise<MensagemThread[]> {
  
  
  
  let q = cliente
    .from('mensagens')
    
    
    
    .select('id, externo_id, direcao, autor, texto, midia, status, origem_em, ultimo_erro')
    .eq('workspace_id', ws)
    .eq('conversa_id', conversaId)
    
    
    .order('origem_em', { ascending: false })
    .limit(MENSAGENS)
  
  
  
  
  
  
  
  
  
  
  
  
  if (antes) q = q.lte('origem_em', antes)

  const { data, error } = await q
  if (error) throw error

  return (
    ((data ?? []) as Record<string, unknown>[])
      .map((row) => ({
        id: row.id as string,
        externoId: (row.externo_id as string | null) ?? null,
        direcao: row.direcao as 'entrada' | 'saida',
        autor: row.autor as MensagemThread['autor'],
        texto: (row.texto as string) ?? '',
        midia: (row.midia as MidiaLinha | null) ?? null,
        status: row.status as string,
        origemEm: row.origem_em as string,
        ultimoErro: (row.ultimo_erro as string | null) ?? null,
      }))
      
      
      
      .reverse()
  )
}
