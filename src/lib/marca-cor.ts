import { contraste } from '@/lib/contraste'



const BRANCO = '#FFFFFF'


export const PIOR_FUNDO_ESCURO = '#17171F'


export const SUPERFICIE_ESCURA = '#101016'


export const PISO_BRANCO = 4.5

export const PISO_ESCURO = 4.5


const PISO_HOVER = 6.5
const PISO_ACTIVE = 8.5


export const PISO_WASH = 4.5


const PISO_HOVER_ESCURO = 6.5
const PISO_ATIVO_ESCURO = 8


const PASSO_VISIVEL = 0.12


const PASSO_ABSOLUTO = 6


export type Paleta = {
  accent: string
  hover: string
  active: string
  wash: string
  line: string
}

export type Marca = {
  
  accent: string
  claro: Paleta
  escuro: Paleta
}

export type ErroMarca = { erro: 'hex_invalido' } | { erro: 'contraste_baixo'; medido: number }

function componentes(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function paraHex([r, g, b]: [number, number, number]): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}


function misturar(hex: string, alvo: [number, number, number], f: number): string {
  const [r, g, b] = componentes(hex)
  return paraHex([r + (alvo[0] - r) * f, g + (alvo[1] - g) * f, b + (alvo[2] - b) * f])
}


function deslocar(hex: string, n: number): string {
  const [r, g, b] = componentes(hex)
  return paraHex([r + n, g + n, b + n])
}

const PRETO_RGB: [number, number, number] = [0, 0, 0]
const BRANCO_RGB: [number, number, number] = [255, 255, 255]

const SUPERFICIE_ESCURA_RGB = componentes(SUPERFICIE_ESCURA)


function escurecerAte(hex: string, piso: number): string {
  let atual = hex
  for (let i = 0; i < 100 && contraste(atual, BRANCO) < piso; i++) {
    atual = misturar(atual, PRETO_RGB, 0.04)
  }
  return atual
}


function clarearAte(hex: string, piso: number): string {
  let atual = hex
  for (let i = 0; i < 100 && contraste(atual, PIOR_FUNDO_ESCURO) < piso; i++) {
    atual = misturar(atual, BRANCO_RGB, 0.04)
  }
  return atual
}


function washAte(
  hex: string,
  alvo: [number, number, number],
  fInicial: number,
  piso: number,
): string {
  let f = fInicial
  let atual = misturar(hex, alvo, f)
  while (f < 1 && contraste(hex, atual) < piso) {
    f = Math.min(1, f + 0.02)
    atual = misturar(hex, alvo, f)
  }
  return atual
}


function normalizar(entrada: string): string | null {
  const limpo = String(entrada ?? '').trim().toUpperCase()
  const curto = limpo.match(/^#([0-9A-F])([0-9A-F])([0-9A-F])$/)
  if (curto) return `#${curto[1]}${curto[1]}${curto[2]}${curto[2]}${curto[3]}${curto[3]}`
  return /^#[0-9A-F]{6}$/.test(limpo) ? limpo : null
}


function derivarClaro(accent: string): Paleta {
  
  
  
  
  
  
  
  
  
  
  let hover = escurecerAte(misturar(accent, PRETO_RGB, PASSO_VISIVEL), PISO_HOVER)
  
  let active = escurecerAte(misturar(hover, PRETO_RGB, PASSO_VISIVEL), PISO_ACTIVE)

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (hover === accent || active === hover) {
    hover = deslocar(accent, PASSO_ABSOLUTO)
    active = deslocar(hover, PASSO_ABSOLUTO)
  }

  return {
    accent,
    hover,
    active,
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    wash: washAte(accent, BRANCO_RGB, 0.93, PISO_WASH),
    line: misturar(accent, BRANCO_RGB, 0.72),
  }
}


function derivarEscuro(accent: string): Paleta {
  const base = clarearAte(accent, PISO_ESCURO)
  const hover = clarearAte(misturar(base, BRANCO_RGB, PASSO_VISIVEL), PISO_HOVER_ESCURO)
  return {
    accent: base,
    hover,
    active: clarearAte(misturar(hover, BRANCO_RGB, PASSO_VISIVEL), PISO_ATIVO_ESCURO),
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    wash: washAte(base, SUPERFICIE_ESCURA_RGB, 0.92, PISO_WASH),
    line: misturar(base, SUPERFICIE_ESCURA_RGB, 0.7),
  }
}

export function derivarMarca(entrada: string): Marca | ErroMarca {
  const accent = normalizar(entrada)
  if (!accent) return { erro: 'hex_invalido' }

  const medido = contraste(accent, BRANCO)
  if (medido < PISO_BRANCO) return { erro: 'contraste_baixo', medido }

  return {
    accent,
    claro: derivarClaro(accent),
    escuro: derivarEscuro(accent),
  }
}
