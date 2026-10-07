
import 'server-only'
import { randomBytes } from 'node:crypto'
import { deleteSecret, getSecret, setSecret } from '@/server/secrets'
import {
  credenciaisCloud,
  credenciaisDeCanal,
  credenciaisInstagram,
  PISO_SEGREDO_CANAL,
  SLUG_CLOUD,
  SLUG_INSTAGRAM,
  SLUG_UAZAPI,
  type CanalCreds,
} from '@/server/canais/types'


export const CHAVE_ADMIN = 'uazapi_admin_token'
export const chaveToken = (canalId: string): string => `uazapi_token_${canalId}`
export const chaveWebhook = (canalId: string): string => `uazapi_webhook_secret_${canalId}`


export const chaveAppSecret = (canalId: string): string => `meta_app_secret_${canalId}`

export const chaveVerifyToken = (canalId: string): string => `meta_verify_token_${canalId}`


export function cunharSegredo(): string {
  return randomBytes(32).toString('base64url')
}


export type ResultadoCreds =
  | { creds: CanalCreds }
  
  | { creds: null; motivo: 'sem_config' }
  
  | { creds: null; motivo: 'sem_segredo' }

type CanalParaCredencial = {
  id: string
  provider: string
  serverUrl: string
  externalId: string | null
}


type FormaDeCredencial = {
  configFaltando: boolean
  construir: (token: string) => CanalCreds | null
}


function formaDeCredencial(canal: CanalParaCredencial): FormaDeCredencial | null {
  switch (canal.provider) {
    case SLUG_UAZAPI:
      return {
        configFaltando: !canal.serverUrl,
        construir: (token) => credenciaisDeCanal({ serverUrl: canal.serverUrl, token }),
      }
    case SLUG_CLOUD:
      return {
        configFaltando: !canal.externalId,
        construir: (token) =>
          credenciaisCloud({ accessToken: token, phoneNumberId: canal.externalId as string }),
      }
    case SLUG_INSTAGRAM:
      return {
        configFaltando: !canal.externalId,
        construir: (token) =>
          credenciaisInstagram({ accessToken: token, contaId: canal.externalId as string }),
      }
    default:
      return null
  }
}

export async function lerCredenciais(canal: CanalParaCredencial): Promise<ResultadoCreds> {
  
  
  
  
  
  
  
  
  
  
  
  
  const forma = formaDeCredencial(canal)
  if (!forma || forma.configFaltando) return { creds: null, motivo: 'sem_config' }

  const token = await getSecret(chaveToken(canal.id))
  if (!token) return { creds: null, motivo: 'sem_segredo' }

  const creds = forma.construir(token)
  return creds ? { creds } : { creds: null, motivo: 'sem_segredo' }
}


export function aparadoOuLanca(rotulo: string, valor: string): string {
  
  const limpo = typeof valor === 'string' ? valor.trim() : ''
  if (limpo.length < PISO_SEGREDO_CANAL) {
    throw new Error(`${rotulo}: cole o valor inteiro — o piso é de ${PISO_SEGREDO_CANAL} caracteres`)
  }
  return limpo
}


export async function gravarSegredosDoCanal(
  canalId: string,
  token: string,
  segredoWebhook: string,
): Promise<boolean> {
  const tokenLimpo = aparadoOuLanca('token do canal', token)
  const webhookLimpo = aparadoOuLanca('segredo do endereço de recebimento', segredoWebhook)
  const gravouToken = await setSecret(chaveToken(canalId), tokenLimpo)
  const gravouWebhook = await setSecret(chaveWebhook(canalId), webhookLimpo)
  return gravouToken && gravouWebhook
}


export async function gravarSegredosDaMeta(
  canalId: string,
  accessToken: string,
  appSecret: string,
  verifyToken: string,
  segredoWebhook: string,
): Promise<boolean> {
  const tokenLimpo = aparadoOuLanca('token de acesso', accessToken)
  const appSecretLimpo = aparadoOuLanca('chave de assinatura do aplicativo', appSecret)
  const verifyLimpo = aparadoOuLanca('token de verificação', verifyToken)
  const webhookLimpo = aparadoOuLanca('segredo do endereço de recebimento', segredoWebhook)
  
  
  
  
  
  
  
  
  
  const g1 = await setSecret(chaveToken(canalId), tokenLimpo)
  const g2 = await setSecret(chaveAppSecret(canalId), appSecretLimpo)
  const g3 = await setSecret(chaveVerifyToken(canalId), verifyLimpo)
  const g4 = await setSecret(chaveWebhook(canalId), webhookLimpo)
  return g1 && g2 && g3 && g4
}


export async function apagarSegredosDoCanal(canalId: string): Promise<void> {
  await deleteSecret(chaveToken(canalId))
  await deleteSecret(chaveWebhook(canalId))
  await deleteSecret(chaveAppSecret(canalId))
  await deleteSecret(chaveVerifyToken(canalId))
}
