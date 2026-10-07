import type { Condicao, Op } from '@/lib/automacao-condicao'



export type Combinador = 'e' | 'ou'
export type LinhaCondicao = { campo: string; op: Op; valor: string }

const OPS_SEM_VALOR: Op[] = ['preenchido', 'vazio']


export function linhasParaCondicao(linhas: LinhaCondicao[], combinador: Combinador): Condicao | null {
  const partes: Condicao[] = linhas
    .filter((l) => l.campo.trim() !== '')
    .map((l) => (OPS_SEM_VALOR.includes(l.op) ? { campo: l.campo, op: l.op } : { campo: l.campo, op: l.op, valor: l.valor }))

  if (partes.length === 0) return null
  if (partes.length === 1) return partes[0]
  return combinador === 'ou' ? { ou: partes } : { e: partes }
}


export function condicaoParaLinhas(cond: Condicao | null | undefined): { linhas: LinhaCondicao[]; combinador: Combinador } {
  const vazio = { linhas: [] as LinhaCondicao[], combinador: 'e' as Combinador }
  if (cond === null || cond === undefined) return vazio
  if (typeof cond !== 'object') return vazio

  if (ehFolha(cond)) return { linhas: [folhaParaLinha(cond)], combinador: 'e' }
  if ('e' in cond && Array.isArray(cond.e) && cond.e.length > 0 && cond.e.every(ehFolha)) {
    return { linhas: cond.e.map(folhaParaLinha), combinador: 'e' }
  }
  if ('ou' in cond && Array.isArray(cond.ou) && cond.ou.length > 0 && cond.ou.every(ehFolha)) {
    return { linhas: cond.ou.map(folhaParaLinha), combinador: 'ou' }
  }
  return vazio
}

function ehFolha(c: Condicao): c is { campo: string; op: Op; valor?: unknown } {
  return typeof c === 'object' && c !== null && 'campo' in c && typeof c.campo === 'string'
}

function folhaParaLinha(c: { campo: string; op: Op; valor?: unknown }): LinhaCondicao {
  return { campo: c.campo, op: c.op, valor: c.valor === undefined || c.valor === null ? '' : String(c.valor) }
}
