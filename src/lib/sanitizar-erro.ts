


const CREDENCIAL_NA_URL = /(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi


const TOKEN_SOLTO = /\b(github_pat_[A-Za-z0-9_]{10,}|gh[pousr]_[A-Za-z0-9]{10,})\b/g


const JWT = /\beyJ[A-Za-z0-9_.-]{15,}/g


const GATILHO_DE_DEPLOY = /(\/api\/deploy\/)[^/\s?#]+/gi


const CHAVE_DE_MODELO = /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g


const SEGREDO_DE_WEBHOOK = /(\/api\/canais\/[^/\s]+\/webhook\/[^/\s]+\/)[^/\s?#"']+/gi

export function sanitizarErro(mensagem: string): string {
  return String(mensagem ?? '')
    .replace(CREDENCIAL_NA_URL, '$1***@')
    .replace(TOKEN_SOLTO, '***')
    .replace(JWT, '***')
    .replace(GATILHO_DE_DEPLOY, '$1***')
    .replace(CHAVE_DE_MODELO, '***')
    .replace(SEGREDO_DE_WEBHOOK, '$1***')
}


export function mensagemSegura(erro: unknown): string {
  try {
    if (erro instanceof Error) return sanitizarErro(erro.message)
    if (erro && typeof erro === 'object') {
      const m = (erro as { message?: unknown }).message
      if (typeof m === 'string') return sanitizarErro(m)
    }
    return sanitizarErro(String(erro))
  } catch {
    return 'erro nao textualizavel'
  }
}


export function detalheSeguro(erro: unknown): string {
  try {
    const base = textoDetalhado(erro)
    const c = codigoDeErro(erro)
    return sanitizarErro(c ? `${base} [${c}]` : base)
  } catch {
    return 'erro nao textualizavel'
  }
}


function textoDetalhado(erro: unknown): string {
  if (!erro || typeof erro !== 'object') return String(erro)
  const o = erro as { message?: unknown; stack?: unknown }
  const msg = typeof o.message === 'string' ? o.message : ''
  const pilha = typeof o.stack === 'string' ? o.stack : ''
  if (pilha && (!msg || pilha.includes(msg))) return pilha
  return msg || String(erro)
}


function codigoDeErro(erro: unknown): string | null {
  if (!erro || typeof erro !== 'object') return null
  const c = (erro as { code?: unknown }).code
  return typeof c === 'string' && c.length > 0 && c.length <= 40 ? c : null
}
