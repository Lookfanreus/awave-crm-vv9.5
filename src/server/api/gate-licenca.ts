import 'server-only'
import { motivoDeBloqueioAtual } from '@/server/license/bloqueio'
import { erroV1 } from '@/server/api/erro'


export async function bloqueioDeLicencaV1(): Promise<Response | null> {
  const motivo = await motivoDeBloqueioAtual()
  if (!motivo) return null

  
  
  const message =
    motivo === 'hard'
      ? 'licenca deste CRM revogada; a API v1 nao serve dado ate a licenca voltar. abra /licenca no CRM'
      : 'licenca deste CRM sem validar ha mais de 3 dias; a API v1 volta sozinha na proxima validacao. abra /licenca no CRM'
  return erroV1('licenca_bloqueada', message, 403, { motivo })
}
