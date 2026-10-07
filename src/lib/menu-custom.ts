import { normalizarSlug } from '@/lib/zona-custom'



export const MAX_ITENS = 10


export const MAX_TITULO = 40
export const MAX_CAMINHO = 200
export const MAX_GRUPO = 24
export const MAX_ICONE = 40

export const GRUPO_PADRAO = 'Personalizado'


export const ICONES_PERMITIDOS = [
  'Wallet', 'FileText', 'Package', 'Truck', 'Receipt', 'Users',
  'Bot', 'Boxes', 'ClipboardList', 'Landmark', 'Sparkles', 'Puzzle',
] as const

export type IconePermitido = (typeof ICONES_PERMITIDOS)[number]


export const ICONE_PADRAO: IconePermitido = 'Puzzle'

export type ItemMenuCustom = {
  titulo: string
  caminho: string
  icone: IconePermitido
  grupo: string
}


function caminhoValido(caminho: string): boolean {
  if (!caminho.startsWith('/x/')) return false
  return normalizarSlug(caminho.slice(3).split('/')) !== null
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 && t.length <= max ? t : null
}

export function normalizarMenu(bruto: unknown): ItemMenuCustom[] {
  if (!Array.isArray(bruto)) return []

  const itens: ItemMenuCustom[] = []
  for (const cru of bruto) {
    if (!cru || typeof cru !== 'object' || Array.isArray(cru)) continue
    const c = cru as Record<string, unknown>

    const titulo = texto(c.titulo, MAX_TITULO)
    const caminho = texto(c.caminho, MAX_CAMINHO)
    
    
    if (!titulo || !caminho || !caminhoValido(caminho)) continue

    const icone = texto(c.icone, MAX_ICONE)
    itens.push({
      titulo,
      caminho,
      icone:
        icone && (ICONES_PERMITIDOS as readonly string[]).includes(icone)
          ? (icone as IconePermitido)
          : ICONE_PADRAO,
      grupo: texto(c.grupo, MAX_GRUPO) ?? GRUPO_PADRAO,
    })

    if (itens.length === MAX_ITENS) break
  }
  return itens
}
