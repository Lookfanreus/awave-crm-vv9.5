


const TIPOS: Record<string, string> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
}


const SO_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/


const PISO_BASE64 = 64


export function qrParaImagem(bruto: string | null | undefined): string | null {
  const texto = typeof bruto === 'string' ? bruto.trim() : ''
  if (!texto) return null

  const m = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(texto)
  const tipo = TIPOS[(m ? m[1] : 'image/png').trim().toLowerCase()]
  if (!tipo) return null

  
  
  
  const corpo = (m ? m[2] : texto).replace(/\s+/g, '')
  if (corpo.length < PISO_BASE64) return null
  if (!SO_BASE64.test(corpo)) return null

  return `data:${tipo};base64,${corpo}`
}
