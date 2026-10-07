


function normalizar(hex: string): string {
  if (typeof hex !== 'string') throw new Error(`cor inválida: esperado hex em texto, veio ${hex === null ? 'null' : typeof hex}`)
  const limpo = hex.trim().toUpperCase()
  const curto = limpo.match(/^#([0-9A-F])([0-9A-F])([0-9A-F])$/)
  if (curto) return `#${curto[1]}${curto[1]}${curto[2]}${curto[2]}${curto[3]}${curto[3]}`
  if (!/^#[0-9A-F]{6}$/.test(limpo))
    throw new Error(
      `cor inválida: "${hex}" — esperado hex de 3 ou 6 dígitos com # (ex.: #125FD6). Alfa (8 dígitos) não é suportado: componha sobre o fundo antes.`,
    )
  return limpo
}


export function luminancia(hex: string): number {
  const n = parseInt(normalizar(hex).slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}


export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)]
  const [alto, baixo] = x > y ? [x, y] : [y, x]
  return (alto + 0.05) / (baixo + 0.05)
}


export function passaAA(
  frente: string,
  fundo: string,
  tamanho: 'normal' | 'grande' = 'normal',
): boolean {
  return contraste(frente, fundo) >= (tamanho === 'grande' ? 3 : 4.5)
}
