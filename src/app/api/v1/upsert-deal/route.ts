import { z } from 'zod'
import { autenticarRota } from '@/server/api/autenticar-rota'
import { mapearErroCrm } from '@/server/api/mapear-erro'
import { erroV1 } from '@/server/api/erro'
import { bloqueioDeLicencaV1 } from '@/server/api/gate-licenca'
import { upsertPorChaveExterna, criarNegocio } from '@/server/crm/negocios'

export const dynamic = 'force-dynamic'



const schema = z.strictObject({
  chave_externa: z.string().min(1).optional(),
  titulo: z.string().min(1),
  contato_id: z.string().optional(),
  empresa_id: z.string().optional(),
  valor: z.string().optional(),
  responsavel_id: z.string().optional(),
  
  
  campos: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: Request) {
  const auth = await autenticarRota(req)
  if (auth instanceof Response) return auth
  
  
  
  const bloqueio = await bloqueioDeLicencaV1()
  if (bloqueio) return bloqueio
  let corpo: unknown
  try { corpo = JSON.parse(auth.raw) } catch { return erroV1('entrada_invalida', 'json invalido', 400) }
  const p = schema.safeParse(corpo)
  if (!p.success) return erroV1('entrada_invalida', 'validacao falhou', 400)
  try {
    
    
    const { chave_externa, ...resto } = p.data
    const negocio = chave_externa
      ? await upsertPorChaveExterna(auth.workspaceId, { chave_externa, ...resto })
      : await criarNegocio(auth.workspaceId, resto)
    return Response.json({ data: negocio })
  } catch (err) {
    return mapearErroCrm(err)
  }
}
