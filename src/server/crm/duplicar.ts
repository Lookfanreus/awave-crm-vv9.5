'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { admin } from '@/server/supabase'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { tituloDaCopia } from '@/lib/duplicar-copy'
import { detalheSeguro } from '@/lib/sanitizar-erro'



type Res = { ok: true; id: string; titulo: string; ordem: number } | { erro: string }


const HERDADAS =
  'titulo, valor, moeda, responsavel_id, contato_id, empresa_id, pipeline_id, etapa_id, ordem, campos, previsao_fechamento'

export async function duplicarNegocio({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return { erro: 'sem_workspace' }

  try {
    const { data, error } = await cliente
      .from('negocios').select(HERDADAS)
      .eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return { erro: 'nao_encontrado' }

    const orig = data as unknown as Record<string, unknown>

    const { data: nova, error: e2 } = await admin()
      .from('negocios')
      .insert({
        ...orig,
        workspace_id: ws,
        titulo: tituloDaCopia(String(orig.titulo ?? '')),
        
        status: 'aberto',
        motivo_perda: null,
        fechado_em: null,
        chave_externa: null,
        
        
        
        
        
        
        
        
        ordem: orig.ordem,
      })
      .select('id, titulo, ordem')
      .single()
    if (e2) throw e2

    const n = nova as { id: string; titulo: string; ordem: number }
    return { ok: true, id: n.id, titulo: n.titulo, ordem: n.ordem }
  } catch (err) {
    console.error('[duplicar] negocio', detalheSeguro(err))
    return { erro: 'falha_duplicar' }
  }
}
