import { z } from 'zod'
import { autenticarRota } from '@/server/api/autenticar-rota'
import { mapearErroCrm } from '@/server/api/mapear-erro'
import { erroV1 } from '@/server/api/erro'
import { bloqueioDeLicencaV1 } from '@/server/api/gate-licenca'
import { registrarAtividade } from '@/server/crm/atividades'

export const dynamic = 'force-dynamic'



const schema = z.object({
  tipo: z.string().min(1),                 
  conteudo: z.string().optional(),
  negocio_id: z.string().optional(),
  contato_id: z.string().optional(),
  chave_externa: z.string().optional(),
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
    const atividade = await registrarAtividade(auth.workspaceId, { ...p.data, autor: 'ia' })
    
    return Response.json({ data: { ...atividade, tipo: atividade.tipo.slug } })
  } catch (err) {
    return mapearErroCrm(err)
  }
}
