'use server'

import { randomUUID } from 'node:crypto'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { admin } from '@/server/supabase'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { validarAnexo, nomeSeguro, caminhoDoAnexo, type TipoAnexo } from '@/lib/anexo'
import { detalheSeguro } from '@/lib/sanitizar-erro'



const BUCKET = 'anexos'


const SEGUNDOS_DO_LINK = 300

export type Anexo = {
  id: string
  nome: string
  tamanho: number
  tipo: string
  criado_em: string
}

type Res = { ok: true } | { erro: string }

async function sessaoEws() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  return { cliente, ws }
}

export async function listarAnexos(negocioId: string): Promise<Anexo[]> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return []
  const { data, error } = await cliente
    .from('anexos')
    .select('id, nome, tamanho, tipo, criado_em')
    .eq('workspace_id', ws).eq('negocio_id', negocioId)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data as Anexo[] | null) ?? []
}

export async function enviarAnexo(dados: FormData): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }

  const negocioId = String(dados.get('negocioId') ?? '')
  if (!negocioId) return { erro: 'nao_encontrado' }

  const bruto = dados.get('arquivo')
  const f = bruto as { name?: string; type?: string; size?: number; arrayBuffer?: () => Promise<ArrayBuffer> }
  if (!f || typeof f.arrayBuffer !== 'function') return { erro: 'sem_arquivo' }

  
  
  const v = validarAnexo({ tipo: f.type, tamanho: f.size })
  if (!v.ok) return { erro: v.erro }

  
  
  
  const { data: neg, error: eNeg } = await cliente
    .from('negocios').select('id').eq('workspace_id', ws).eq('id', negocioId).maybeSingle()
  if (eNeg) return { erro: 'falha_enviar' }
  if (!neg) return { erro: 'nao_encontrado' }

  const id = randomUUID()
  const tipo = f.type as TipoAnexo
  const caminho = caminhoDoAnexo(ws, negocioId, id, tipo)

  try {
    const bytes = Buffer.from(await f.arrayBuffer!())
    const { error: eUp } = await admin().storage.from(BUCKET).upload(caminho, bytes, {
      contentType: tipo,
      
      
      
      upsert: false,
    })
    if (eUp) throw eUp

    
    
    
    const { error: eIns } = await admin().from('anexos').insert({
      id,
      workspace_id: ws,
      negocio_id: negocioId,
      caminho,
      nome: nomeSeguro(String(f.name ?? 'arquivo')),
      tamanho: f.size ?? 0,
      tipo,
    })
    
    
    if (eIns) {
      await admin().storage.from(BUCKET).remove([caminho]).catch(() => {})
      throw eIns
    }

    await invalidarNegocio(negocioId)
    return { ok: true }
  } catch (err) {
    console.error('[anexos] enviar', detalheSeguro(err))
    return { erro: 'falha_enviar' }
  }
}

export async function excluirAnexo({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }

  try {
    
    
    const { data, error } = await cliente
      .from('anexos').select('caminho, negocio_id')
      .eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return { erro: 'nao_encontrado' }
    const a = data as { caminho: string; negocio_id: string }

    
    
    
    const { error: eDel } = await admin()
      .from('anexos').delete().eq('workspace_id', ws).eq('id', id)
    if (eDel) throw eDel

    
    
    await admin().storage.from(BUCKET).remove([a.caminho]).catch((e) => {
      console.warn('[anexos] objeto orfao em', a.caminho, detalheSeguro(e))
    })

    await invalidarNegocio(a.negocio_id)
    return { ok: true }
  } catch (err) {
    console.error('[anexos] excluir', detalheSeguro(err))
    return { erro: 'falha_excluir' }
  }
}


export async function urlDoAnexo({ id }: { id: string }): Promise<{ url: string } | { erro: string }> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }

  try {
    const { data, error } = await cliente
      .from('anexos').select('caminho, nome')
      .eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return { erro: 'nao_encontrado' }
    const a = data as { caminho: string; nome: string }

    const { data: assinada, error: eSig } = await admin().storage
      .from(BUCKET)
      
      
      
      
      .createSignedUrl(a.caminho, SEGUNDOS_DO_LINK, { download: a.nome })
    if (eSig || !assinada?.signedUrl) throw eSig ?? new Error('sem url')

    return { url: assinada.signedUrl }
  } catch (err) {
    console.error('[anexos] url', detalheSeguro(err))
    return { erro: 'falha_link' }
  }
}


async function invalidarNegocio(negocioId: string): Promise<void> {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath(`/negocios/${negocioId}`)
  } catch (err) {
    console.warn('[anexos] revalidatePath falhou (não-fatal):', detalheSeguro(err))
  }
}
