

export const TIPOS_CAMPO = [
  'texto', 'texto_longo', 'numero', 'moeda', 'data',
  'selecao_unica', 'selecao_multipla', 'checkbox',
  'email', 'telefone', 'documento', 'responsavel',
  'conexao_contato', 'conexao_empresa', 'conexao_negocio',
] as const
export type TipoCampo = (typeof TIPOS_CAMPO)[number]

export type OpcaoCampo = { id: string; rotulo: string; cor?: string; arquivada?: boolean }
export type DefCampo = { slug: string; tipo: TipoCampo; opcoes?: OpcaoCampo[]; config?: { casas?: number } }

export type ResultadoValor = { ok: true; valor: unknown } | { ok: false; erro: string }

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RE_MOEDA = /^-?\d{1,12}(\.\d{1,2})?$/
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/

function soDigitos(s: string): string { return s.replace(/\D/g, '') }


function cpfValido(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += Number(d[i]) * (10 - i)
  if ((s * 10) % 11 % 10 !== Number(d[9])) return false
  s = 0
  for (let i = 0; i < 10; i++) s += Number(d[i]) * (11 - i)
  return (s * 10) % 11 % 10 === Number(d[10])
}


function cnpjValido(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const dv = (base: string, pesos: number[]) => {
    const s = base.split('').reduce((acc, c, i) => acc + Number(c) * pesos[i], 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  if (dv(d.slice(0, 12), p1) !== Number(d[12])) return false
  return dv(d.slice(0, 13), p2) === Number(d[13])
}


function dataReal(iso: string): boolean {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function idsDeOpcoes(def: DefCampo): string[] {
  return (def.opcoes ?? []).map((o) => o.id)
}

export function validarValor(def: DefCampo, bruto: unknown): ResultadoValor {
  
  if (bruto === null || bruto === undefined || bruto === '') return { ok: true, valor: undefined }

  switch (def.tipo) {
    case 'texto':
    case 'texto_longo': {
      if (typeof bruto !== 'string') return { ok: false, erro: 'tipo_invalido' }
      const v = bruto.trim()
      if (!v) return { ok: true, valor: undefined }
      const max = def.tipo === 'texto' ? 500 : 5000
      if (v.length > max) return { ok: false, erro: 'muito_longo' }
      return { ok: true, valor: v }
    }
    case 'numero': {
      if (typeof bruto !== 'number' && typeof bruto !== 'string') return { ok: false, erro: 'tipo_invalido' }
      
      
      
      if (typeof bruto === 'string' && bruto.trim() === '') return { ok: true, valor: undefined }
      const n = typeof bruto === 'number' ? bruto : Number(bruto)
      if (!Number.isFinite(n)) return { ok: false, erro: 'nao_numerico' }
      return { ok: true, valor: n }
    }
    case 'moeda': {
      const bruta = typeof bruto === 'number' ? String(bruto) : bruto
      if (typeof bruta !== 'string' || !RE_MOEDA.test(bruta.trim())) return { ok: false, erro: 'moeda_invalida' }
      
      const [inteiro, dec = ''] = bruta.trim().split('.')
      return { ok: true, valor: `${inteiro}.${(dec + '00').slice(0, 2)}` }
    }
    case 'data': {
      if (typeof bruto !== 'string' || !RE_DATA.test(bruto) || !dataReal(bruto))
        return { ok: false, erro: 'data_invalida' }
      return { ok: true, valor: bruto }
    }
    case 'selecao_unica': {
      if (typeof bruto !== 'string') return { ok: false, erro: 'tipo_invalido' }
      if (!idsDeOpcoes(def).includes(bruto)) return { ok: false, erro: 'opcao_invalida' }
      return { ok: true, valor: bruto }
    }
    case 'selecao_multipla': {
      if (!Array.isArray(bruto)) return { ok: false, erro: 'tipo_invalido' }
      if (bruto.length > 50) return { ok: false, erro: 'muitas_opcoes' }
      const ids = idsDeOpcoes(def)
      const vistos = new Set<string>()
      for (const item of bruto) {
        if (typeof item !== 'string') return { ok: false, erro: 'tipo_invalido' }
        if (!ids.includes(item)) return { ok: false, erro: 'opcao_invalida' }
        if (vistos.has(item)) return { ok: false, erro: 'opcao_repetida' }
        vistos.add(item)
      }
      return { ok: true, valor: bruto }
    }
    case 'checkbox': {
      if (typeof bruto !== 'boolean') return { ok: false, erro: 'tipo_invalido' }
      return { ok: true, valor: bruto }
    }
    case 'email': {
      if (typeof bruto !== 'string') return { ok: false, erro: 'tipo_invalido' }
      const v = bruto.trim().toLowerCase()
      if (!RE_EMAIL.test(v)) return { ok: false, erro: 'email_invalido' }
      return { ok: true, valor: v }
    }
    case 'telefone': {
      if (typeof bruto !== 'string') return { ok: false, erro: 'tipo_invalido' }
      const d = soDigitos(bruto)
      if (d.length < 10 || d.length > 13) return { ok: false, erro: 'telefone_invalido' }
      return { ok: true, valor: d }
    }
    case 'documento': {
      if (typeof bruto !== 'string') return { ok: false, erro: 'tipo_invalido' }
      const d = soDigitos(bruto)
      if (d.length === 11 ? !cpfValido(d) : d.length === 14 ? !cnpjValido(d) : true)
        return { ok: false, erro: 'documento_invalido' }
      return { ok: true, valor: d }
    }
    case 'responsavel':
    case 'conexao_contato':
    case 'conexao_empresa':
    case 'conexao_negocio': {
      if (typeof bruto !== 'string' || !RE_UUID.test(bruto)) return { ok: false, erro: 'referencia_invalida' }
      return { ok: true, valor: bruto }
    }
  }
}


export function aplicarPatch(
  defs: DefCampo[],
  atual: Record<string, unknown>,
  patch: Record<string, unknown>,
): { ok: true; campos: Record<string, unknown> } | { ok: false; erros: Array<{ slug: string; erro: string }> } {
  const porSlug = new Map(defs.map((d) => [d.slug, d]))
  const erros: Array<{ slug: string; erro: string }> = []
  const saida: Record<string, unknown> = { ...atual }

  for (const [slug, bruto] of Object.entries(patch)) {
    const def = porSlug.get(slug)
    if (!def) { erros.push({ slug, erro: 'campo_desconhecido' }); continue }
    const r = validarValor(def, bruto)
    if (!r.ok) { erros.push({ slug, erro: r.erro }); continue }
    if (r.valor === undefined) delete saida[slug]
    else saida[slug] = r.valor
  }

  if (erros.length) return { ok: false, erros }
  return { ok: true, campos: saida }
}
