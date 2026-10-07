

export type Tema = 'claro' | 'escuro'


export const TEMA_PADRAO: Tema = 'escuro'


export const COOKIE_TEMA = 'awave_tema'


export function normalizarTema(v: unknown): Tema | null {
  return v === 'claro' || v === 'escuro' ? v : null
}


export function resolverTema({ sessao, cookie }: { sessao: unknown; cookie: unknown }): Tema {
  if (sessao !== undefined && sessao !== null) return normalizarTema(sessao) ?? TEMA_PADRAO
  return normalizarTema(cookie) ?? TEMA_PADRAO
}


export function atributoTema(t: Tema): 'claro' | undefined {
  return t === 'claro' ? 'claro' : undefined
}
