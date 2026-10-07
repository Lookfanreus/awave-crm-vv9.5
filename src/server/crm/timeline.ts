import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { detalheSeguro } from '@/lib/sanitizar-erro'


export async function logEtapaMudou(
  clienteAdmin: SupabaseClient,
  ws: string,
  negocioId: string,
  etapaNome: string,
): Promise<void> {
  try {
    const { data: t, error: eTipo } = await clienteAdmin.from('tipos_atividade')
      .select('id').eq('workspace_id', ws).eq('slug', 'etapa_mudou').maybeSingle()
    if (eTipo) {
      console.error('[timeline] etapa_mudou: falha ao resolver o tipo', { ws, negocioId, erro: eTipo })
      return
    }
    if (!t) return
    const { error: eIns } = await clienteAdmin.from('atividades').insert({
      workspace_id: ws,
      negocio_id: negocioId,
      tipo_id: (t as { id: string }).id,
      autor: 'staff',
      conteudo: 'Movido para ' + etapaNome,
    })
    if (eIns) {
      console.error('[timeline] etapa_mudou: insert recusado', { ws, negocioId, erro: eIns })
    }
  } catch (err) {
    
    console.error('[timeline] etapa_mudou: exceção', { ws, negocioId, erro: detalheSeguro(err) })
  }
}
