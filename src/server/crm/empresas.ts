import { admin } from '@/server/supabase'
import { escaparCuringa } from '@/lib/canais/escapar-curinga'




const COLS = 'id, nome, site, telefone, notas, criado_em, atualizado_em'

export type Empresa = {
  id: string
  nome: string
  site: string | null
  telefone: string | null
  notas: string | null
  criado_em: string
  atualizado_em: string
}


type CamposEmpresa = {
  nome?: string
  site?: string | null
  telefone?: string | null
  notas?: string | null
}


function patchPermitido(campos: CamposEmpresa): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (campos.nome !== undefined) patch.nome = campos.nome
  if (campos.site !== undefined) patch.site = campos.site
  if (campos.telefone !== undefined) patch.telefone = campos.telefone
  if (campos.notas !== undefined) patch.notas = campos.notas
  return patch
}

export async function criarEmpresa(workspaceId: string, campos: {
  nome: string
  site?: string | null
  telefone?: string | null
  notas?: string | null
}): Promise<Empresa> {
  const payload = patchPermitido(campos)
  payload.nome = campos.nome 
  payload.workspace_id = workspaceId
  const { data, error } = await admin()
    .from('empresas')
    .insert(payload)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Empresa
}

export async function atualizarEmpresa(workspaceId: string, id: string, campos: CamposEmpresa): Promise<Empresa | null> {
  const patch = patchPermitido(campos)
  
  if (Object.keys(patch).length === 0) return buscarEmpresa(workspaceId, id)

  const { data, error } = await admin()
    .from('empresas')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Empresa
}

export async function buscarEmpresa(workspaceId: string, id: string): Promise<Empresa | null> {
  const { data, error } = await admin()
    .from('empresas')
    .select(COLS)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) throw error
  return (data as Empresa | null) ?? null
}

export async function listarEmpresas(workspaceId: string, {
  limit = 50,
  offset = 0,
  busca,
}: {
  limit?: number
  offset?: number
  busca?: string
}): Promise<Empresa[]> {
  let q = admin().from('empresas').select(COLS).eq('workspace_id', workspaceId)
  if (busca) q = q.ilike('nome', '%' + escaparCuringa(busca) + '%')
  const { data, error } = await q.order('nome').range(offset, offset + limit - 1)
  if (error) throw error
  return (data as Empresa[] | null) ?? []
}
