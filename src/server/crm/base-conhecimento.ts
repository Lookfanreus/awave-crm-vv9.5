
import 'server-only'
import { admin } from '@/server/supabase'

export type EntradaListada = {
  id: string
  titulo: string
  conteudo: string
  tipo: 'fato' | 'playbook'
  origem: 'operador' | 'aprendizado'
  habilitado: boolean
  
  temVetor: boolean
  atualizado_em: string
  
  assistentes: string[] | null
}


const COLUNAS = 'id, titulo, conteudo, tipo, origem, habilitado, embed_versao, atualizado_em'


export async function listarBase(ws: string): Promise<EntradaListada[]> {
  const { data, error } = await admin()
    .from('base_conhecimento')
    .select(COLUNAS)
    .eq('workspace_id', ws)
    .order('atualizado_em', { ascending: false })
  if (error || !data) throw new Error('falha ao ler a base de conhecimento deste espaço de trabalho')

  const linhas = data as Array<Record<string, unknown>>
  const ids = linhas.map((l) => String(l.id))

  
  
  
  
  
  
  
  
  
  
  
  
  let recorteFalhou = false
  const recortePorBloco = new Map<string, string[]>()
  if (ids.length > 0) {
    const { data: recorteBruto, error: erroRecorte } = await admin()
      .from('assistente_blocos')
      .select('bloco_id, assistente_id')
      .eq('workspace_id', ws)
      .in('bloco_id', ids)
    if (erroRecorte || !recorteBruto) {
      recorteFalhou = true
    } else {
      for (const r of recorteBruto as Array<{ bloco_id: string; assistente_id: string }>) {
        const lista = recortePorBloco.get(r.bloco_id) ?? []
        lista.push(r.assistente_id)
        recortePorBloco.set(r.bloco_id, lista)
      }
    }
  }

  return linhas.map((l) => ({
    id: String(l.id),
    titulo: String(l.titulo),
    conteudo: String(l.conteudo),
    tipo: l.tipo as 'fato' | 'playbook',
    origem: l.origem as 'operador' | 'aprendizado',
    habilitado: Boolean(l.habilitado),
    temVetor: l.embed_versao !== null && l.embed_versao !== undefined,
    atualizado_em: String(l.atualizado_em),
    assistentes: recorteFalhou ? null : (recortePorBloco.get(String(l.id)) ?? []),
  }))
}


export async function contarSemVetor(ws: string): Promise<number> {
  const { count, error } = await admin()
    .from('base_conhecimento')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ws)
    .is('embed_versao', null)
  return error ? 0 : (count ?? 0)
}
