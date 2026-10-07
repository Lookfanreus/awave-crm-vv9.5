


const ALTOS_1252 =
  '€‚ƒ„…†‡ˆ‰Š‹ŒŽ' +
  '‘’“”•–—˜™š›œžŸ'


function decodificarWindows1252(bytes: Uint8Array): string {
  let saida = ''
  for (const b of bytes) {
    saida += b >= 0x80 && b <= 0x9f ? ALTOS_1252[b - 0x80] : String.fromCharCode(b)
  }
  return saida
}


const BOMS: { bytes: number[]; rotulo: string }[] = [
  { bytes: [0xff, 0xfe], rotulo: 'utf-16le' },
  { bytes: [0xfe, 0xff], rotulo: 'utf-16be' },
  { bytes: [0xef, 0xbb, 0xbf], rotulo: 'utf-8' },
]

export type CodificacaoCsv = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'windows-1252'

function comecaCom(b: Uint8Array, assinatura: number[]): boolean {
  if (b.length < assinatura.length) return false
  return assinatura.every((x, i) => b[i] === x)
}


export function detectarCodificacao(bytes: Uint8Array): CodificacaoCsv {
  for (const { bytes: assinatura, rotulo } of BOMS) {
    if (comecaCom(bytes, assinatura)) return rotulo === 'utf-8' ? 'utf-8-bom' : (rotulo as CodificacaoCsv)
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return 'utf-8'
  } catch {
    return 'windows-1252'
  }
}


export function decodificarCsv(bytes: Uint8Array): string {
  const codificacao = detectarCodificacao(bytes)
  
  
  
  
  if (codificacao === 'windows-1252') return decodificarWindows1252(bytes)

  const rotulo = codificacao === 'utf-8-bom' ? 'utf-8' : codificacao
  const texto = new TextDecoder(rotulo).decode(bytes)
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
}
