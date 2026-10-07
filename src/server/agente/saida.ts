
import 'server-only'
import { admin } from '@/server/supabase'
import { carregaDisclosure, PREFIXO_BUSCAVEL_DO_DISCLOSURE } from '@/lib/canais/disclosure'
import { detalheSeguro } from '@/lib/sanitizar-erro'
import { getProvider } from '@/server/canais/registry'
import { mdParaWhatsapp } from '@/lib/whatsapp/mdParaWhatsapp'


export function textoParaOCanal(texto: string, provider: string | null | undefined): string {
  if (typeof provider !== 'string' || !provider) return texto
  return getProvider(provider)?.capabilities.sintaxeWhatsapp === true ? mdParaWhatsapp(texto) : texto
}


export const TETO_BOLHAS = 3


export async function contarAvisosEntregues(
  ws: string,
  conversaId: string,
): Promise<{ avisosEntregues: number; ultimoAvisoEm: string | null }> {
  try {
    const { data, error } = await admin()
      .from('mensagens')
      .select('origem_em, texto')
      .eq('workspace_id', ws)
      .eq('conversa_id', conversaId)
      .eq('direcao', 'saida')
      .eq('autor', 'agente')
      .in('status', ['enviada', 'entregue', 'lida'])
      .like('texto', `${PREFIXO_BUSCAVEL_DO_DISCLOSURE}%`)
      .order('origem_em', { ascending: false })
      .limit(1)
    if (error) throw error
    const linhas = (data ?? []) as Array<{ origem_em?: string; texto?: string }>
    const linha = linhas[0]
    const ultimo = linha && carregaDisclosure(linha.texto) ? (linha.origem_em ?? null) : null
    return { avisosEntregues: ultimo ? 1 : 0, ultimoAvisoEm: ultimo }
  } catch (err) {
    
    
    
    
    console.warn('[agente/saida] contagem falhou — identificando assim mesmo:', detalheSeguro(err))
    return { avisosEntregues: 0, ultimoAvisoEm: null }
  }
}
