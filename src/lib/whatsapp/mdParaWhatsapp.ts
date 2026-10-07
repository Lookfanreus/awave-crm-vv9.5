




export const TETO_CONVERSAO = 20_000


const NEGRITO_ITALICO = /\*\*\*([^*\n]{1,2000})\*\*\*/gu
const NEGRITO = /\*\*([^*\n]{1,2000})\*\*/g
const ITALICO = /(?<![\p{L}\p{N}])\*([^*\n]{1,2000})\*(?![\p{L}\p{N}])/gu
const RISCADO = /~~([^~\n]{1,2000})~~/g

const LINK = /\[([^[\]\n]{1,200})\]\(([^)\s[\]]{1,2000})\)/g
const BULLET = /^[-*] /gm


export function mdParaWhatsapp(md: string): string {
  const MARCA = '\u0000NEGRITO\u0000'
  
  
  
  
  const limpo = md.replace(/\u0000/g, '')
  
  
  if (limpo.length > TETO_CONVERSAO) return limpo
  return limpo
    .replace(NEGRITO_ITALICO, `${MARCA}_$1_${MARCA}`)
    .replace(NEGRITO, `${MARCA}$1${MARCA}`)
    .replace(ITALICO, '_$1_')
    .replace(new RegExp(MARCA, 'g'), '*')
    .replace(RISCADO, '~$1~')
    .replace(LINK, '$1: $2')
    .replace(BULLET, '• ')
}
