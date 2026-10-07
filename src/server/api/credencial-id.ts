import 'server-only'
import { randomBytes } from 'node:crypto'


export function gerarKeyId(): string {
  return 'wsk_' + randomBytes(12).toString('hex')
}


export function gerarSegredo(): string {
  return randomBytes(32).toString('hex')
}
