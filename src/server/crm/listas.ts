import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { escaparCuringa } from '@/lib/canais/escapar-curinga'







export const PAGINA = 25

export type ContatoLista = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  origem: string | null
  empresaNome: string | null
}

export type EmpresaLista = {
  id: string
  nome: string
  site: string | null
  telefone: string | null
  numContatos: number
}

export type Pagina<T> = { itens: T[]; temMais: boolean }






function nomeEmbed(x: unknown): string | null {
  if (!x) return null
  const o = Array.isArray(x) ? x[0] : x
  return (o as { nome?: string } | undefined)?.nome ?? null
}


function contarEmbed(x: unknown): number {
  if (!x) return 0
  if (Array.isArray(x)) return (x[0] as { count?: number } | undefined)?.count ?? 0
  return (x as { count?: number })?.count ?? 0
}





export async function listarContatos(
  cliente: SupabaseClient,
  ws: string,
  opts: { busca?: string; p?: number },
): Promise<Pagina<ContatoLista>> {
  const p = opts.p ?? 0
  const inicio = p * PAGINA
  const fim = inicio + PAGINA - 1

  let q = cliente
    .from('contatos')
    .select('id, nome, email, telefone, origem, empresas(nome)')
    .eq('workspace_id', ws)

  if (opts.busca) q = q.ilike('nome', '%' + escaparCuringa(opts.busca) + '%')

  const { data, error } = await q.order('nome').range(inicio, fim)
  if (error) throw error

  const rows = (data ?? []) as Record<string, unknown>[]
  const itens: ContatoLista[] = rows.map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    email: (row.email as string | null) ?? null,
    telefone: (row.telefone as string | null) ?? null,
    origem: (row.origem as string | null) ?? null,
    empresaNome: nomeEmbed(row.empresas),
  }))

  return { itens, temMais: itens.length === PAGINA }
}





export async function listarEmpresas(
  cliente: SupabaseClient,
  ws: string,
  opts: { busca?: string; p?: number },
): Promise<Pagina<EmpresaLista>> {
  const p = opts.p ?? 0
  const inicio = p * PAGINA
  const fim = inicio + PAGINA - 1

  let q = cliente
    .from('empresas')
    .select('id, nome, site, telefone, contatos(count)')
    .eq('workspace_id', ws)

  if (opts.busca) q = q.ilike('nome', '%' + escaparCuringa(opts.busca) + '%')

  const { data, error } = await q.order('nome').range(inicio, fim)
  if (error) throw error

  const rows = (data ?? []) as Record<string, unknown>[]
  const itens: EmpresaLista[] = rows.map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    site: (row.site as string | null) ?? null,
    telefone: (row.telefone as string | null) ?? null,
    numContatos: contarEmbed(row.contatos),
  }))

  return { itens, temMais: itens.length === PAGINA }
}
