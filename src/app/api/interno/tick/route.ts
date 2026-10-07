import { tickAutomacao } from '@/server/automacao/tick'
import { entregarPendentes } from '@/server/webhook/entrega'
import { baterLicenca } from '@/server/license/batida'
import { drenarFila } from '@/server/canais/envio'
import { drenarAgente } from '@/server/agente/runtime'
import { drenarMidia } from '@/server/canais/midia-tick'
import { drenarPerfis } from '@/server/canais/perfil-tick'
import { tickCustom } from '@/server/custom/tick'
import { expurgar } from '@/server/canais/expurgo'
import { criarOrcamento } from '@/lib/orcamento-tick'
import { detalheSeguro } from '@/lib/sanitizar-erro'

export const dynamic = 'force-dynamic'


export async function POST(req: Request) {
  const esperado = process.env.TICK_SECRET
  if (!esperado) return Response.json({ error: 'tick_desligado' }, { status: 403 })
  if (req.headers.get('authorization') !== esperado) return Response.json({ error: 'nao_autorizado' }, { status: 401 })
  
  
  
  
  
  const comecoDoTick = Date.now()
  const orcamento = criarOrcamento(comecoDoTick)
  const automacao = await tickAutomacao(orcamento)
  const entrega = await entregarPendentes(orcamento)
  
  
  
  
  
  
  
  
  
  const licenca = await baterLicenca()
  
  
  
  
  
  
  
  
  
  
  
  
  
  await drenarFila(orcamento).catch((err) => {
    console.warn('[tick] braço da fila de saída falhou:', detalheSeguro(err))
  })
  
  
  
  
  const agente = await drenarAgente(orcamento).catch((err) => {
    
    
    
    console.warn('[tick] braço do assistente falhou:', detalheSeguro(err))
    return { reivindicados: 0, respondidos: 0, pulados: 0 }
  })
  
  
  
  
  
  const midia = await drenarMidia(orcamento).catch((err) => {
    console.warn('[tick] braço da mídia falhou:', detalheSeguro(err))
    return { baixadas: 0, falhas: 0, adiadas: 0, semCota: 0 }
  })
  
  
  
  
  
  
  
  
  
  const perfis = await drenarPerfis(orcamento).catch((err) => {
    console.warn('[tick] braço dos perfis falhou:', detalheSeguro(err))
    return { resolvidos: 0, adiados: 0, semCredencial: 0, desistidos: 0 }
  })
  
  
  
  const custom = await tickCustom(orcamento).catch((err) => {
    console.warn('[tick] braço da zona de customização falhou:', detalheSeguro(err))
    return { tarefas: 0, eventos: 0 }
  })
  
  
  
  
  
  
  
  
  const expurgo = await expurgar(orcamento).catch((err) => {
    console.warn('[tick] braço de retenção falhou:', detalheSeguro(err))
    return { rodou: false, jobs: 0, custos: 0, conversasSimulador: 0, objetos: 0 }
  })
  return Response.json({
    data: { automacao, entrega, licenca, agente, midia, perfis, custom, expurgo },
  })
}
