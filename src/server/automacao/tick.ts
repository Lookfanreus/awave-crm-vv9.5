import 'server-only'
import { mensagemSegura } from '@/lib/sanitizar-erro'
import { criarOrcamento, type Orcamento } from '@/lib/orcamento-tick'
import { planejar } from '@/server/automacao/planejador'
import { executarPendentes } from '@/server/automacao/executor'


export async function tickAutomacao(
  orcamento: Orcamento = criarOrcamento(Date.now()),
): Promise<Record<string, unknown>> {
  const resumo: Record<string, unknown> = {}
  try {
    resumo.planejado = await planejar()
  } catch (e) {
    resumo.erroPlanejador = msg(e)
  }
  
  
  
  
  
  
  
  
  
  
  
  if (!orcamento.cabe('automacao')) {
    resumo.pulado = 'sem folga no tick'
    return resumo
  }
  try {
    
    
    resumo.executado = await executarPendentes(new Date(), () => new Date(), orcamento)
  } catch (e) {
    resumo.erroExecutor = msg(e)
  }
  return resumo
}


function msg(e: unknown): string {
  return mensagemSegura(e)
}
