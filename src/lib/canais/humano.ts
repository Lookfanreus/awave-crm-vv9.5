




















const ALVOS =
  'atendentes?|atendimento|humanos?|supervisor(?:es)?|gerentes?|algu[ée]m|uma\\s+pessoa|a\\s+pessoa|pessoa\\s+real|gente\\s+de\\s+verdade|suporte|respons[áa]vel|setor|time|financeiro|comercial|vendedor|superior|quem\\s+(?:resolve|entende|cuida|pode\\s+ajudar|possa\\s+ajudar)'


const VERBOS_DE_ROTEAMENTO = 'transfere|transferir|transfira|conecta'


const CAUDA_SEM_OBJETO = '(?:\\s*,?\\s*(?:por favor|pfvr?|pf|ai|a[íi]|agora|urgente|please))*'


const PEDIU_HUMANO = new RegExp(
  [
    
    '\\b(quero|queria|gostaria|preciso|pode(ria)?|posso|me)\\b[^.?!]{0,40}\\b(falar|conversar|atendimento|atendentes?|humanos?|pessoa\\s+real|gente\\s+de\\s+verdade|supervisor(?:es)?|gerentes?)\\b',
    
    
    
    
    
    
    
    
    
    `\\b(me\\s+(passa|transfere|transfira|conecta)|transfer(e|ir))\\b[^.?!]{0,30}\\b(${ALVOS})\\b`,
    
    
    
    
    
    
    `\\b(?:me\\s+)?(?:${VERBOS_DE_ROTEAMENTO})\\b${CAUDA_SEM_OBJETO}\\s*(?=[.?!\\n]|$)`,
    
    
    '\\bchama(r)?\\s+(um|uma|o|a)\\s+(humanos?|atendentes?|supervisor(?:es)?|gerentes?)\\b',
    
    '\\b(atendimento\\s+humano|atendente\\s+humano)\\b',
    
    
    
    
    
    
    
    
    
    
    
    
    '\\b(falar|conversar)\\s+com\\s+(?:(?:o|a|um|uma|algum|alguma)\\s+)?(atendentes?|humanos?|pessoas?|algu[ée]m|supervisor(?:es)?|gerentes?)\\b',
  ].join('|'),
  'i',
)


const FALSO_POSITIVO_G = /pessoa\s+(f[íi]sica|jur[íi]dica)/gi


const ALVO_DE_ATENDIMENTO = new RegExp(`\\b(${ALVOS})\\b`, 'i')


const INVISIVEIS_G = /[\u00AD\u180E\u200B-\u200D\u2060]/g


const ESPACO_HORIZONTAL_G = /[^\S\n]+/g


function normalizarPedido(texto: string): string {
  return (texto ?? '').replace(INVISIVEIS_G, '').replace(ESPACO_HORIZONTAL_G, ' ').trim()
}

export function pediuHumano(texto: string): boolean {
  const t = normalizarPedido(texto)
  if (!t) return false
  
  
  
  
  
  
  
  
  
  const sem = t.replace(FALSO_POSITIVO_G, '')
  if (sem !== t && !ALVO_DE_ATENDIMENTO.test(sem)) return false
  return PEDIU_HUMANO.test(t)
}


export function pediuHumanoNoLote(textos: string[]): boolean {
  return (textos ?? []).some((t) => pediuHumano(t))
}


export function escalouDepois(escaladaEm: string | null, ultimaMsgInAt: string | null): boolean {
  if (!escaladaEm) return false
  
  if (!ultimaMsgInAt) return true
  const tEsc = Date.parse(escaladaEm)
  const tIn = Date.parse(ultimaMsgInAt)
  
  
  
  if (!Number.isFinite(tEsc) || !Number.isFinite(tIn)) return false
  return tEsc >= tIn
}


export function devolveuDepois(devolvidaEm: string | null, ultimaMsgInAt: string | null): boolean {
  
  
  if (!devolvidaEm) return false
  
  
  
  
  if (!ultimaMsgInAt) return true
  const tDev = Date.parse(devolvidaEm)
  const tIn = Date.parse(ultimaMsgInAt)
  
  
  if (!Number.isFinite(tDev) || !Number.isFinite(tIn)) return false
  return tDev > tIn
}


export const CONFIRMACAO_HUMANO =
  'Sua conversa foi marcada para o time. Ela já está na lista de quem atende por aqui.'
