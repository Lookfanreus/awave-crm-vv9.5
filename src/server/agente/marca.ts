








import 'server-only'
import { admin } from '@/server/supabase'
import { mensagemSegura } from '@/lib/sanitizar-erro'


export const MARCAS = {
  falhou:
    'O assistente não conseguiu responder esta conversa. Ela continua aberta para alguém do time responder.',
  sem_chave:
    'O assistente está ligado neste canal, mas a chave de IA não está configurada. Ninguém respondeu automaticamente.',
  teto_conversa:
    'O assistente atingiu o limite de respostas automáticas desta conversa nesta hora. Alguém do time precisa continuar daqui.',
  teto_servidor:
    'O limite de respostas automáticas deste servidor foi atingido nesta hora. Alguém do time precisa continuar daqui.',
  pedido_de_humano:
    'O cliente pediu para falar com uma pessoa. O assistente parou de responder esta conversa.',
  resposta_cortada:
    'A resposta do assistente era longa demais e foi cortada nas três primeiras mensagens.',
  
  
  
  
  base_indisponivel:
    'O assistente respondeu sem conseguir consultar a base de conhecimento. Ele pode ter dito que não tem uma informação que está escrita lá.',
} as const

export type MotivoDaMarca = keyof typeof MARCAS


export const JANELA_DE_REPETICAO_MS: Record<MotivoDaMarca, number> = {
  falhou: 0,
  sem_chave: 0,
  teto_conversa: 0,
  teto_servidor: 0,
  pedido_de_humano: 0,
  resposta_cortada: 0,
  base_indisponivel: 60 * 60_000,
}


async function jaMarcadaAgora(
  ws: string,
  conversaId: string,
  motivo: MotivoDaMarca,
  agoraIso: string,
): Promise<boolean> {
  const janela = JANELA_DE_REPETICAO_MS[motivo]
  if (janela <= 0) return false
  const desde = new Date(Date.parse(agoraIso) - janela).toISOString()
  const { data, error } = await admin()
    .from('mensagens')
    .select('id')
    .eq('workspace_id', ws)
    .eq('conversa_id', conversaId)
    .eq('status', 'descartada')
    .eq('texto', MARCAS[motivo])
    .gte('origem_em', desde)
    .limit(1)
  return !error && Array.isArray(data) && data.length > 0
}


export async function marcarNaInbox(
  ws: string,
  conversaId: string,
  motivo: MotivoDaMarca,
  agoraIso: string,
): Promise<void> {
  
  
  
  if (await jaMarcadaAgora(ws, conversaId, motivo, agoraIso)) return

  const { error } = await admin()
    .from('mensagens')
    .insert({
      workspace_id: ws,
      conversa_id: conversaId,
      direcao: 'saida',
      autor: 'agente',
      texto: MARCAS[motivo],
      status: 'descartada',
      origem_em: agoraIso,
    })
  if (error) throw error

  const { error: erroRpc } = await admin().rpc('registrar_mensagem_na_conversa', {
    p_ws: ws,
    p_conversa: conversaId,
    p_quando: agoraIso,
    p_entrada: false,
  })
  
  
  
  if (erroRpc) console.warn('[agente/marca] a conversa nao subiu na lista (fail-open):', mensagemSegura(erroRpc))
}
