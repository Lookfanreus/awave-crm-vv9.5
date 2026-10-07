


export const CHAVE_URL_PUBLICA = 'url_publica_do_crm'

export type ErroUrlPublica = 'vazia' | 'nao_e_url' | 'exige_https'


export function normalizarUrlPublica(
  bruta: string,
): { ok: true; origem: string } | { ok: false; erro: ErroUrlPublica } {
  const texto = typeof bruta === 'string' ? bruta.trim() : ''
  if (!texto) return { ok: false, erro: 'vazia' }
  let u: URL
  try {
    u = new URL(texto)
  } catch {
    return { ok: false, erro: 'nao_e_url' }
  }
  if (u.protocol !== 'https:') return { ok: false, erro: 'exige_https' }
  return { ok: true, origem: u.origin }
}
