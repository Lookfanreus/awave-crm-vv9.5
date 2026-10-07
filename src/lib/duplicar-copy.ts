

const SUFIXO = 'cópia'


const RE_COPIA = /\s*\((?:cópia)(?:\s+(\d+))?\)\s*$/i


export function tituloDaCopia(titulo: string): string {
  const base = titulo.trim()
  if (!base) return `(${SUFIXO})`

  const m = base.match(RE_COPIA)
  if (!m) return `${base} (${SUFIXO})`

  const semSufixo = base.replace(RE_COPIA, '')
  
  const proximo = m[1] ? Number(m[1]) + 1 : 2
  
  return semSufixo ? `${semSufixo} (${SUFIXO} ${proximo})` : `(${SUFIXO} ${proximo})`
}
