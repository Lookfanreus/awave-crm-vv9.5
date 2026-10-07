import { admin } from '@/server/supabase'
import { mesclarCampos } from '@/server/crm/campos-leitura'
import { CrmContatoNomeObrigatorio, CrmCamposInvalidos } from '@/server/crm/erros'
import { escaparCuringa } from '@/lib/canais/escapar-curinga'




const COLS = 'id, nome, email, telefone, chave_externa, origem, notas, empresa_id, campos, criado_em, atualizado_em'

export type Contato = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  chave_externa: string | null
  origem: string | null
  notas: string | null
  empresa_id: string | null
  campos: Record<string, unknown>
  criado_em: string
  atualizado_em: string
}


type CamposContato = {
  nome?: string
  email?: string | null
  telefone?: string | null
  origem?: string | null
  notas?: string | null
  empresa_id?: string | null
}

function patchPermitido(campos: CamposContato): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (campos.nome !== undefined) patch.nome = campos.nome
  if (campos.email !== undefined) patch.email = campos.email
  if (campos.telefone !== undefined) patch.telefone = campos.telefone
  if (campos.origem !== undefined) patch.origem = campos.origem
  if (campos.notas !== undefined) patch.notas = campos.notas
  if (campos.empresa_id !== undefined) patch.empresa_id = campos.empresa_id
  return patch
}


async function resolverCampos(
  workspaceId: string,
  atual: Record<string, unknown>,
  patch: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | undefined> {
  if (!patch) return undefined
  const r = await mesclarCampos(admin(), workspaceId, 'contato', atual, patch)
  if (!r.ok) throw new CrmCamposInvalidos(r.slugs)
  return r.campos
}

export async function criarContato(workspaceId: string, dados: {
  nome: string
  email?: string | null
  telefone?: string | null
  chave_externa?: string | null
  origem?: string | null
  notas?: string | null
  empresa_id?: string | null
  
  campos?: Record<string, unknown>
}): Promise<Contato> {
  const payload = patchPermitido(dados)
  payload.nome = dados.nome 
  if (dados.chave_externa !== undefined) payload.chave_externa = dados.chave_externa
  payload.workspace_id = workspaceId
  const camposFinal = await resolverCampos(workspaceId, {}, dados.campos)
  if (camposFinal !== undefined) payload.campos = camposFinal
  const { data, error } = await admin()
    .from('contatos')
    .insert(payload)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Contato
}

export async function atualizarContato(
  workspaceId: string,
  id: string,
  dados: CamposContato & { campos?: Record<string, unknown> },
): Promise<Contato | null> {
  const patch = patchPermitido(dados)
  if (Object.keys(patch).length === 0 && !dados.campos) return buscarContato(workspaceId, id)

  if (dados.campos) {
    
    const atual = await buscarContato(workspaceId, id)
    if (atual) patch.campos = await resolverCampos(workspaceId, atual.campos ?? {}, dados.campos)
  }

  const { data, error } = await admin()
    .from('contatos')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Contato
}

export async function buscarContato(workspaceId: string, id: string): Promise<Contato | null> {
  const { data, error } = await admin()
    .from('contatos')
    .select(COLS)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) throw error
  return (data as Contato | null) ?? null
}

export async function listarContatos(workspaceId: string, {
  limit = 50,
  offset = 0,
  empresa_id,
  busca,
}: {
  limit?: number
  offset?: number
  empresa_id?: string
  busca?: string
}): Promise<Contato[]> {
  let q = admin().from('contatos').select(COLS).eq('workspace_id', workspaceId)
  if (empresa_id) q = q.eq('empresa_id', empresa_id)
  if (busca) q = q.ilike('nome', '%' + escaparCuringa(busca) + '%')
  const { data, error } = await q.order('nome').range(offset, offset + limit - 1)
  if (error) throw error
  return (data as Contato[] | null) ?? []
}


export async function buscarPorChaveExterna(workspaceId: string, chave: string): Promise<Contato | null> {
  const { data, error } = await admin()
    .from('contatos')
    .select(COLS)
    .eq('workspace_id', workspaceId)
    .eq('chave_externa', chave)
    .maybeSingle()
  if (error) throw error
  return (data as Contato | null) ?? null
}


export async function upsertPorChaveExterna(workspaceId: string, a: {
  chave_externa: string
  nome?: string
  email?: string | null
  telefone?: string | null
  origem?: string | null
  notas?: string | null
  empresa_id?: string | null
  campos?: Record<string, unknown>
}): Promise<Contato> {
  const { chave_externa, ...dados } = a
  const patch = patchPermitido(dados)

  const existente = await buscarPorChaveExterna(workspaceId, chave_externa)

  if (existente) {
    
    const camposFinal = await resolverCampos(workspaceId, existente.campos ?? {}, dados.campos)
    if (camposFinal !== undefined) patch.campos = camposFinal
    const { data, error } = await admin()
      .from('contatos')
      .update(patch)
      .eq('id', existente.id)
      .eq('workspace_id', workspaceId)
      .select(COLS)
      .single()
    if (error) throw error
    return data as Contato
  }

  if (!dados.nome) throw new CrmContatoNomeObrigatorio()
  const camposNovo = await resolverCampos(workspaceId, {}, dados.campos)
  if (camposNovo !== undefined) patch.campos = camposNovo
  const { data, error } = await admin()
    .from('contatos')
    .insert({ chave_externa, ...patch, workspace_id: workspaceId })
    .select(COLS)
    .single()
  if (error) throw error
  return data as Contato
}
