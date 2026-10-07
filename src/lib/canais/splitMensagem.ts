
import { recuarParaFronteira } from '@/lib/canais/grafema'


export const UAZAPI_MAX_CHARS = 4000


export function splitMensagem(texto: string, teto: number = UAZAPI_MAX_CHARS): string[] {
  if (semConteudo(texto)) return []
  
  
  
  
  
  if (teto <= 0) return [texto]

  const pedacos: string[] = []
  let resto = texto

  while (resto.length > teto) {
    const janela = resto.slice(0, teto)
    const quebra = janela.lastIndexOf('\n')
    
    
    const cortouNaQuebra = quebra > teto / 2
    const alvo = cortouNaQuebra ? quebra : teto
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const corte = semConteudo(resto.slice(alvo)) ? alvo : recuarParaFronteira(resto, alvo)
    const pedaco = resto.slice(0, corte)
    if (pedaco.length > 0) pedacos.push(pedaco)
    
    
    resto = cortouNaQuebra ? resto.slice(corte + 1) : resto.slice(corte)
  }

  
  
  
  
  
  
  
  
  
  if (!semConteudo(resto)) pedacos.push(resto)
  return pedacos
}


function semConteudo(s: string): boolean {
  return s.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().length === 0
}

