import { admin } from '@/server/supabase'
import { CrmAtividadeSemAlvo, CrmTipoDesconhecido } from '@/server/crm/erros'
import { slugCanonico } from '@/server/crm/agenda'




const COLS = 'id, conteudo, autor, chave_externa, contato_id, negocio_id, criado_em, ' +
  'vencimento, concluida_em, responsavel_id, tipo:tipos_atividade!atividades_tipo_fk(slug, nome, icone, natureza)'

export type TipoAninhado = { slug: string; nome: string; icone: string; natureza: 'atividade' | 'nota' | 'sistema' }
export type AutorAtividade = 'staff' | 'ia'

export type Atividade = {
  id: string
  tipo: TipoAninhado
  conteudo: string | null
  autor: AutorAtividade
  chave_externa: string | null
  contato_id: string | null
  negocio_id: string | null
  criado_em: string
  vencimento: string | null
  concluida_em: string | null
  responsavel_id: string | null
}


function mapAtividade(row: Record<string, unknown>): Atividade {
  const t = row.tipo
  const tipo = (Array.isArray(t) ? t[0] : t) as TipoAninhado
  return { ...(row as unknown as Atividade), tipo }
}


export async function resolverTipoIdPorSlug(workspaceId: string, slug: string): Promise<string> {
  const canonico = slugCanonico(slug)
  const { data, error } = await admin()
    .from('tipos_atividade').select('id')
    .eq('workspace_id', workspaceId).eq('slug', canonico).maybeSingle()
  if (error) throw error
  if (!data) throw new CrmTipoDesconhecido(slug)
  return (data as { id: string }).id
}

export type TipoAtividadeItem = TipoAninhado & { id: string; ordem: number; bloqueado: boolean }


export async function listarTipos(workspaceId: string): Promise<TipoAtividadeItem[]> {
  const { data, error } = await admin()
    .from('tipos_atividade').select('id, slug, nome, icone, natureza, ordem, bloqueado')
    .eq('workspace_id', workspaceId).order('ordem')
  if (error) throw error
  return (data as TipoAtividadeItem[] | null) ?? []
}


async function buscarPorChaveExterna(workspaceId: string, chave: string): Promise<Atividade | null> {
  const { data, error } = await admin()
    .from('atividades')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .eq('chave_externa', chave)
    .maybeSingle()
  if (error) throw error
  return data ? mapAtividade(data as unknown as Record<string, unknown>) : null
}


export async function registrarAtividade(workspaceId: string, {
  tipo, conteudo, autor = 'staff', contato_id, negocio_id, chave_externa,
  vencimento, responsavel_id, concluida_em,
}: {
  tipo: string
  conteudo?: string | null
  autor?: AutorAtividade
  contato_id?: string | null
  negocio_id?: string | null
  chave_externa?: string | null
  vencimento?: string | null
  responsavel_id?: string | null
  concluida_em?: string | null
}): Promise<Atividade> {
  if (!contato_id && !negocio_id) throw new CrmAtividadeSemAlvo()

  if (chave_externa != null) {
    const existente = await buscarPorChaveExterna(workspaceId, chave_externa)
    if (existente) return existente
  }

  const tipo_id = await resolverTipoIdPorSlug(workspaceId, tipo)
  const payload: Record<string, unknown> = { tipo_id, autor, workspace_id: workspaceId }
  if (conteudo !== undefined) payload.conteudo = conteudo
  if (contato_id !== undefined) payload.contato_id = contato_id
  if (negocio_id !== undefined) payload.negocio_id = negocio_id
  if (chave_externa !== undefined) payload.chave_externa = chave_externa
  if (vencimento !== undefined) payload.vencimento = vencimento
  if (responsavel_id !== undefined) payload.responsavel_id = responsavel_id
  if (concluida_em !== undefined) payload.concluida_em = concluida_em

  const { data, error } = await admin().from('atividades').insert(payload).select(COLS).single()
  if (error) throw error
  return mapAtividade(data as unknown as Record<string, unknown>)
}


export async function concluirAtividade(workspaceId: string, id: string): Promise<void> {
  const { error } = await admin().from('atividades')
    .update({ concluida_em: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('id', id)
  if (error) throw error
}


export async function reagendarAtividade(workspaceId: string, id: string, vencimento: string): Promise<void> {
  const { error } = await admin().from('atividades')
    .update({ vencimento })
    .eq('workspace_id', workspaceId).eq('id', id)
  if (error) throw error
}

export async function listarAtividadesDoContato(
  workspaceId: string,
  contato_id: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Atividade[]> {
  const { data, error } = await admin()
    .from('atividades')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .eq('contato_id', contato_id)
    .order('criado_em', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapAtividade)
}

export async function listarAtividadesDoNegocio(
  workspaceId: string,
  negocio_id: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Atividade[]> {
  const { data, error } = await admin()
    .from('atividades')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .eq('negocio_id', negocio_id)
    .order('criado_em', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapAtividade)
}
