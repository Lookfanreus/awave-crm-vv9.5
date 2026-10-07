'use server'














import { admin } from '@/server/supabase'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import {
  lerConversa,
  listarConversas,
  lerThread,
  type ConversaLista,
  type MensagemThread,
} from './leitura'
import { assinarMidias } from './midia-tick'
import { filtroValido, type FiltroDaInbox } from '@/lib/canais/filtro-inbox'

export async function recarregarLista(
  opts: { pagina: number; busca?: string; filtro?: FiltroDaInbox },
): Promise<ConversaLista[]> {
  const cliente = await criarClienteServidor()
  
  
  
  
  
  
  
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return []
  
  
  
  
  
  
  return listarConversas(cliente, ws, { ...opts, filtro: filtroValido(opts.filtro) })
}

export async function recarregarThread(
  conversaId: string,
  opts: { antes?: string } = {},
): Promise<MensagemThread[]> {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return []
  
  
  
  const mensagens = await lerThread(cliente, ws, conversaId, opts)
  return comMidia(ws, mensagens)
}


async function comMidia(ws: string, mensagens: MensagemThread[]): Promise<MensagemThread[]> {
  const urls = await assinarMidias(ws, mensagens)
  if (urls.size === 0) return mensagens
  return mensagens.map((m) => (urls.has(m.id) ? { ...m, midiaUrl: urls.get(m.id) } : m))
}


export type RecargaDaInbox =
  | {
      ok: true
      conversas: ConversaLista[]
      thread: MensagemThread[] | null
      
      linhaAberta: ConversaLista | null
    }
  | { ok: false }


export async function recarregarInbox(opts: {
  pagina: number
  busca?: string
  conversaAberta?: string | null
  
  filtro?: FiltroDaInbox
}): Promise<RecargaDaInbox> {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return { ok: false }

  const conversas = await listarConversas(cliente, ws, {
    pagina: opts.pagina,
    busca: opts.busca,
    filtro: filtroValido(opts.filtro),
  })
  
  
  if (!opts.conversaAberta) return { ok: true, conversas, thread: null, linhaAberta: null }

  
  
  
  
  
  const [mensagens, linha] = await Promise.all([
    lerThread(cliente, ws, opts.conversaAberta),
    lerConversa(cliente, ws, opts.conversaAberta),
  ])
  return { ok: true, conversas, thread: await comMidia(ws, mensagens), linhaAberta: linha }
}


export type Atendente = { id: string; rotulo: string }


export async function listarAtendentes(): Promise<Atendente[]> {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return []

  const db = admin()
  const { data } = await db
    .from('membros')
    .select('id, user_id')
    .eq('workspace_id', ws)
    .order('criado_em', { ascending: true })

  const linhas = ((data ?? []) as Array<{ id: string; user_id: string }>).slice(0, 100)
  return Promise.all(
    linhas.map(async (mb) => {
      const { data: u } = await db.auth.admin.getUserById(mb.user_id)
      
      
      return { id: mb.id, rotulo: u?.user?.email ?? `membro ${mb.id.slice(0, 8)}` }
    }),
  )
}
