








import { verificarAssinatura } from '@platform/server/custom/verificarAssinatura'


export const HEADER_ASSINATURA = 'x-hub-signature-256'

export const PREFIXO_ASSINATURA = 'sha256='


export function verificarAssinaturaMeta(
  entrada: { raw: string; bytes: Uint8Array; headers: Record<string, string> },
  segredo: string,
): boolean {
  
  
  const { raw, bytes, headers } = entrada ?? {}
  if (typeof raw !== 'string') return false
  if (!headers || typeof headers !== 'object') return false
  if (typeof segredo !== 'string' || segredo.length === 0) return false
  
  
  if (!(bytes instanceof Uint8Array)) return false
  if (!bytesIguais(bytes, raw)) return false

  const recebido = headers[HEADER_ASSINATURA]
  if (typeof recebido !== 'string' || !recebido.startsWith(PREFIXO_ASSINATURA)) return false

  try {
    return verificarAssinatura({
      raw,
      headers,
      
      query: {},
      valorSegredo: segredo,
      descriptor: {
        tipo: 'hmac',
        em: 'header',
        header: HEADER_ASSINATURA,
        encoding: 'hex',
        prefixo: PREFIXO_ASSINATURA,
        
        segredo: 'meta_app_secret',
      },
    })
  } catch {
    
    
    
    return false
  }
}


const CODIFICADOR = new TextEncoder()


function bytesIguais(bytes: Uint8Array, raw: string): boolean {
  const recodificado = CODIFICADOR.encode(raw)
  if (recodificado.length !== bytes.length) return false
  for (let i = 0; i < bytes.length; i++) if (recodificado[i] !== bytes[i]) return false
  return true
}
