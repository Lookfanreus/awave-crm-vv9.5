import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'



const SEL_AGENDA =
  'id, conteudo, criado_em, vencimento, responsavel_id, ' +
  'tipo:tipos_atividade!atividades_tipo_fk(slug, nome, icone, natureza), ' +
  'negocio:negocios(id, titulo), contato:contatos(id, nome)'

type Emb = { slug: string; nome: string; icone: string; natureza: string }
export type ItemAgenda = {
  id: string
  conteudo: string | null
  vencimento: string
  tipo: Emb
  negocio: { id: string; titulo: string } | null
  contato: { id: string; nome: string } | null
}

const TIPO_FALLBACK: Emb = { slug: 'nota', nome: 'Nota', icone: 'StickyNote', natureza: 'nota' }


function um<T>(x: unknown): T | null {
  const o = Array.isArray(x) ? x[0] : x
  return (o as T | undefined) ?? null
}

function mapItem(a: Record<string, unknown>): ItemAgenda {
  return {
    id: a.id as string,
    conteudo: (a.conteudo as string | null) ?? null,
    vencimento: a.vencimento as string,
    tipo: um<Emb>(a.tipo) ?? TIPO_FALLBACK,
    negocio: um<{ id: string; titulo: string }>(a.negocio),
    contato: um<{ id: string; nome: string }>(a.contato),
  }
}


export async function listarAgenda(
  { cliente, ws, membroId, escopo }:
  { cliente: SupabaseClient; ws: string; membroId: string | null; escopo: 'minhas' | 'todas' },
): Promise<ItemAgenda[]> {
  let q = cliente
    .from('atividades')
    .select(SEL_AGENDA)
    .eq('workspace_id', ws)
    .not('vencimento', 'is', null)
    .is('concluida_em', null)
  if (escopo === 'minhas' && membroId) q = q.eq('responsavel_id', membroId) as typeof q
  const { data, error } = await q.order('vencimento', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapItem)
}


export async function listarTiposSessao(
  { cliente, ws }: { cliente: SupabaseClient; ws: string },
): Promise<{ slug: string; nome: string; natureza: string }[]> {
  const { data, error } = await cliente
    .from('tipos_atividade')
    .select('slug, nome, natureza')
    .eq('workspace_id', ws)
    .eq('ativo', true)
    .order('ordem')
  if (error) throw error
  return (data as { slug: string; nome: string; natureza: string }[] | null) ?? []
}
