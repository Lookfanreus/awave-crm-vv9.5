

const PROF_MAX = 8

export type Op = 'igual' | 'diferente' | 'contem' | 'maior' | 'menor' | 'preenchido' | 'vazio'

export type Condicao =
  | { campo: string; op: Op; valor?: unknown }
  | { e: Condicao[] }
  | { ou: Condicao[] }

export type ContextoNegocio = {
  titulo: string
  valor: string | null
  status: string
  etapa_id: string
  responsavel_id: string | null
  campos: Record<string, unknown>
}

const FIXOS = ['titulo', 'valor', 'status', 'etapa_id', 'responsavel_id'] as const

function ler(ctx: ContextoNegocio, campo: string): unknown {
  if ((FIXOS as readonly string[]).includes(campo)) return (ctx as unknown as Record<string, unknown>)[campo]
  return ctx.campos?.[campo]
}


function preenchido(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}


function texto(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function avaliar(cond: Condicao | null | undefined, ctx: ContextoNegocio, prof = 0): boolean {
  if (cond === null || cond === undefined) return true
  if (typeof cond !== 'object') return false
  if (prof > PROF_MAX) return false

  if ('e' in cond) return Array.isArray(cond.e) && cond.e.every((c) => avaliar(c, ctx, prof + 1))
  if ('ou' in cond) return Array.isArray(cond.ou) && cond.ou.some((c) => avaliar(c, ctx, prof + 1))
  if (!('campo' in cond) || typeof cond.campo !== 'string') return false

  const atual = ler(ctx, cond.campo)

  switch (cond.op) {
    case 'preenchido': return preenchido(atual)
    case 'vazio':      return !preenchido(atual)
    case 'igual':      return texto(atual) === texto(cond.valor)
    case 'diferente':  return texto(atual) !== texto(cond.valor)
    case 'contem':
      if (Array.isArray(atual)) return atual.some((x) => texto(x) === texto(cond.valor))
      return texto(atual).includes(texto(cond.valor))
    case 'maior':
    case 'menor': {
      const a = numero(atual), b = numero(cond.valor)
      if (a === null || b === null) return false     
      return cond.op === 'maior' ? a > b : a < b
    }
    default: return false
  }
}
