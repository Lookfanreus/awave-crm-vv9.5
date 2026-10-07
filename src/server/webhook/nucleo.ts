import 'server-only'
import { createHmac } from 'node:crypto'


const DEGRAUS_MIN = [1, 5, 15, 30, 60, 120, 360, 720]
export function backoff(tentativas: number): number {
  const i = Math.min(Math.max(tentativas, 0), DEGRAUS_MIN.length - 1)
  return DEGRAUS_MIN[i] * 60_000
}

export type LinhaOutbox = {
  id: string; tipo: string; workspace_id: string; criado_em: string; payload: unknown
}


export function montarPayload(linha: LinhaOutbox) {
  return {
    id: linha.id, evento: linha.tipo, versao: 'v1' as const,
    workspace_id: linha.workspace_id, ocorrido_em: linha.criado_em, dados: linha.payload,
  }
}


export function assinar(raw: string, segredo: string): string {
  return createHmac('sha256', segredo).update(raw).digest('hex')
}
