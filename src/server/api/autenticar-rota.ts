import 'server-only'
import { getSecret } from '@/server/secrets'
import { autenticarEntrada } from '@/server/api/autenticar'
import { erroV1 } from '@/server/api/erro'
import { buscarCredencialPorKeyId } from '@/server/api/credenciais'


export async function autenticarRota(req: Request): Promise<{ raw: string; workspaceId: string } | Response> {
  const raw = await req.text()
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })

  const naoAutorizado = () => erroV1('nao_autorizado', 'credencial invalida ou ausente', 401)

  const keyId = headers['x-awave-key-id']
  if (!keyId) return naoAutorizado()

  const cred = await buscarCredencialPorKeyId(keyId)
  if (!cred || cred.revogado_em) return naoAutorizado()

  const segredo = await getSecret('api_key:' + keyId)
  if (!autenticarEntrada({ raw, headers, valorSegredo: segredo })) return naoAutorizado()

  return { raw, workspaceId: cred.workspace_id }
}
