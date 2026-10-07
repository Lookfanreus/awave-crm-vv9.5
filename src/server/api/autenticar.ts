import { verificarAssinatura } from '@platform/server/custom/verificarAssinatura'
import type { AuthDescriptor } from '@platform/server/custom/contrato'



const DESCRIPTOR: AuthDescriptor = {
  tipo: 'hmac', em: 'header', header: 'x-awave-signature', encoding: 'hex', segredo: '(injetado-por-rota)',
}


export function autenticarEntrada(e: { raw: string; headers: Record<string, string>; valorSegredo: string | null }): boolean {
  return verificarAssinatura({ raw: e.raw, headers: e.headers, query: {}, descriptor: DESCRIPTOR, valorSegredo: e.valorSegredo })
}
