


















import { cortarNoTeto } from '@/lib/canais/grafema'


export const TETO_MENSAGENS_THREAD = 30

export const TETO_MENSAGENS_HISTORICO = 20

export const TETO_CARACTERES_MENSAGEM = 2000

export const TETO_CARACTERES_BLOCO = 20_000

export type AutorDaMensagem = 'contato' | 'membro' | 'aparelho' | 'agente'

export type MensagemDoPrompt = {
  direcao: 'entrada' | 'saida'
  autor: AutorDaMensagem
  texto: string
  status: string
}

export type FalaDoModelo = { role: 'user' | 'assistant'; content: string }


const STATUS_QUE_CONTAM = new Set(['recebida', 'pendente', 'enviada', 'entregue', 'lida'])


export function neutralizarCerca(texto: string): string {
  return (texto ?? '')
    .replace(/\p{Ps}/gu, '(')
    .replace(/\p{Pe}/gu, ')')
    .replace(FRAGMENTOS_ABRE, '(')
    .replace(FRAGMENTOS_FECHA, ')')
}


const FRAGMENTOS_ABRE = /[⎛⎜⎝⎡⎢⎣⎧⎨⎩⎪⎰⎴⌜⌞⌍⌏⎾⎿⏜⏞⏠˹˻⸢⸤]/g
const FRAGMENTOS_FECHA = /[⎞⎟⎠⎤⎥⎦⎫⎬⎭⎱⎵⌝⌟⌌⌎⏋⏌⏝⏟⏡˺˼⸣⸥]/g


export function rotularAutor(autor: AutorDaMensagem, texto: string): string {
  const corpo = neutralizarCerca(texto)
  if (autor === 'agente') return `[assistente] ${corpo}`
  if (autor === 'membro' || autor === 'aparelho') return `[atendente] ${corpo}`
  return corpo
}


export function temTextoParaOModelo(texto: string | null | undefined): boolean {
  return (texto ?? '').trim() !== ''
}


export function truncarTexto(texto: string, teto = TETO_CARACTERES_MENSAGEM): string {
  const t = (texto ?? '').trim()
  return t.length <= teto ? t : `${cortarNoTeto(t, teto)}…`
}


export function cortarBloco<T>(itens: T[], tamanho: (t: T) => number, teto = TETO_CARACTERES_BLOCO): T[] {
  let total = itens.reduce((s, i) => s + tamanho(i), 0)
  let corte = 0
  while (corte < itens.length - 1 && total > teto) {
    total -= tamanho(itens[corte])
    corte += 1
  }
  return itens.slice(corte)
}


export function montarHistorico(msgs: MensagemDoPrompt[]): FalaDoModelo[] {
  
  
  
  const contam = (msgs ?? []).filter((m) => STATUS_QUE_CONTAM.has(m.status) && temTextoParaOModelo(m.texto))
  const ultimas = contam.slice(-TETO_MENSAGENS_THREAD)
  const falas = ultimas.map((m) => {
    
    
    
    const corpo = neutralizarCerca(truncarTexto(m.texto))
    return {
      role: (m.direcao === 'entrada' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.direcao === 'entrada' ? corpo : rotularAutor(m.autor, corpo),
    }
  })
  return cortarBloco(falas, (f) => f.content.length)
}
