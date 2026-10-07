


export function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return partes
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}


function matizDoNome(nome: string): number {
  let h = 0
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}


function hslParaHex(h: number, s: number, l: number): string {
  const sn = s / 100
  const ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const bit = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase()
  return `#${bit(f(0))}${bit(f(8))}${bit(f(4))}`
}


function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2]
}


const LUM_MAXIMA = 1.05 / 4.5 - 0.05


const TETO_L = 54
const PISO_L = 20


function lightnessLegivel(h: number, s: number): number {
  for (let l = TETO_L; l > PISO_L; l--) {
    if (luminancia(hslParaHex(h, s, l)) <= LUM_MAXIMA) return l
  }
  return PISO_L
}


export function corDoNome(nome: string): { de: string; para: string } {
  const h1 = matizDoNome(nome)
  const h2 = (h1 + 34) % 360
  const l1 = lightnessLegivel(h1, 62)
  const de = hslParaHex(h1, 62, l1)

  
  
  let l2 = Math.min(lightnessLegivel(h2, 64), l1 - 12)

  
  
  
  
  
  const alvo = luminancia(de)
  while (l2 > PISO_L && luminancia(hslParaHex(h2, 64, l2)) > alvo) l2--

  return { de, para: hslParaHex(h2, 64, l2) }
}
