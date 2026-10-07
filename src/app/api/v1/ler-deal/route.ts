import { z } from 'zod'
import { autenticarRota } from '@/server/api/autenticar-rota'
import { mapearErroCrm } from '@/server/api/mapear-erro'
import { erroV1 } from '@/server/api/erro'
import { bloqueioDeLicencaV1 } from '@/server/api/gate-licenca'
import { buscarNegocio, buscarPorChaveExterna } from '@/server/crm/negocios'
import { buscarEtapa } from '@/server/crm/pipelines'
import { buscarContato } from '@/server/crm/contatos'
import { listarAtividadesDoNegocio } from '@/server/crm/atividades'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    id: z.string().optional(),
    chave_externa: z.string().optional(),
  })
  .refine((d) => d.id || d.chave_externa, 'informe id ou chave_externa')

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
    const negocio = p.data.id
      ? await buscarNegocio(auth.workspaceId, p.data.id)
      : await buscarPorChaveExterna(auth.workspaceId, p.data.chave_externa as string)
    if (!negocio) return erroV1('nao_encontrado', 'deal nao encontrado', 404)

    const etapa = await buscarEtapa(auth.workspaceId, negocio.etapa_id)
    const contato = negocio.contato_id ? await buscarContato(auth.workspaceId, negocio.contato_id) : null
    const atividades = await listarAtividadesDoNegocio(auth.workspaceId, negocio.id, { limit: 20, offset: 0 })
    
    const atividadesPlanas = atividades.map((a) => ({ ...a, tipo: a.tipo.slug }))

    return Response.json({ data: { negocio, etapa, contato, atividades: atividadesPlanas } })
  } catch (err) {
    return mapearErroCrm(err)
  }
}
