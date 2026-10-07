// src/server/custom/verificarAssinatura.ts — PURO. Verificação de assinatura de webhook
// (conjunto fechado de esquemas). O valor do segredo é INJETADO (lido do Vault pelo caller)
// pra manter a função determinística e testável. timingSafeEqual sempre (evita timing leak).
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AuthDescriptor } from './contrato'

export interface EntradaVerificacao {
  raw: string
  headers: Record<string, string>
  query: Record<string, string>
  descriptor: AuthDescriptor
  valorSegredo: string | null
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function verificarAssinatura(e: EntradaVerificacao): boolean {
  if (!e.valorSegredo) return false // fail-closed: sem segredo, nada passa
  const d = e.descriptor
  if (d.tipo === 'hmac') {
    const recebido = e.headers[d.header.toLowerCase()]
    if (!recebido) return false
    const semPrefixo = d.prefixo && recebido.startsWith(d.prefixo) ? recebido.slice(d.prefixo.length) : recebido
    const esperado = createHmac('sha256', e.valorSegredo).update(e.raw).digest(d.encoding)
    return safeEq(semPrefixo, esperado)
  }
  // token
  const recebido = d.em === 'header' ? e.headers[d.header.toLowerCase()] : e.query[d.param]
  if (!recebido) return false
  return safeEq(recebido, e.valorSegredo)
}
