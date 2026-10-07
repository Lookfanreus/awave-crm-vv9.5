




import 'server-only'
import { admin } from '@/server/supabase'
import { embedar } from '@/server/agente/embed'
import { ORCAMENTO_BUSCA_MS } from '@/server/agente/orcamento'
import type { AchadoDaBase } from '@/lib/canais/bloco-conhecimento'


const TETO_CONSULTA = 1000


const LIMITE = 5


export type TiposDaBusca = ReadonlyArray<'fato' | 'playbook'> | null


export const TIPOS_DO_BLOCO_AUTOMATICO: TiposDaBusca = ['fato']


export async function buscarNaBase(
  ws: string,
  consulta: string,
  opts: { conversaId: string | null; tipos: TiposDaBusca; assistenteId: string | null },
): Promise<AchadoDaBase[] | 'indisponivel'> {
  const texto = (consulta ?? '').trim().slice(0, TETO_CONSULTA)
  
  
  
  
  
  
  
  
  
  const prazo = AbortSignal.timeout(ORCAMENTO_BUSCA_MS)
  try {
    
    
    const vetor = await embedar(texto, { ws, conversaId: opts.conversaId, sinal: prazo })

    const { data, error } = await admin().rpc('base_conhecimento_buscar', {
      p_ws: ws,
      p_query: texto,
      p_embedding: vetor?.vetor ?? null,
      
      
      p_versao: vetor?.versao ?? null,
      p_limite: LIMITE,
      
      
      p_tipos: opts.tipos === null ? null : [...opts.tipos],
      
      
      
      
      
      p_assistente: opts.assistenteId,
    })
      
      
      
      .abortSignal(prazo)
    
    
    if (error || !data) return 'indisponivel'

    return (data as Array<{ titulo?: string; conteudo?: string; tipo?: string }>).map((l) => ({
      titulo: String(l.titulo ?? ''),
      conteudo: String(l.conteudo ?? ''),
      
      
      tipo: l.tipo === 'playbook' ? 'playbook' : 'fato',
    }))
  } catch {
    return 'indisponivel'
  }
}
