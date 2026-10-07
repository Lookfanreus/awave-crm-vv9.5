import { z } from 'zod'
import { autenticarRota } from '@/server/api/autenticar-rota'
import { mapearErroCrm } from '@/server/api/mapear-erro'
import { erroV1 } from '@/server/api/erro'
import { bloqueioDeLicencaV1 } from '@/server/api/gate-licenca'
import { moverParaEtapa, buscarNegocio } from '@/server/crm/negocios'
import { buscarEtapa } from '@/server/crm/pipelines'
import { logEtapaMudou } from '@/server/crm/timeline'
import { admin } from '@/server/supabase'

export const dynamic = 'force-dynamic'

const schema = z.object({
  negocio_id: z.string().min(1),
  etapa_id: z.string().min(1),
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
    
    await moverParaEtapa(auth.workspaceId, p.data.negocio_id, { etapaId: p.data.etapa_id })
    
    
    
    
    
    
    try {
      const etapa = await buscarEtapa(auth.workspaceId, p.data.etapa_id)
      if (etapa) await logEtapaMudou(admin(), auth.workspaceId, p.data.negocio_id, etapa.nome)
    } catch {
      
    }
    const negocio = await buscarNegocio(auth.workspaceId, p.data.negocio_id)
    return Response.json({ data: negocio })
  } catch (err) {
    return mapearErroCrm(err)
  }
}
