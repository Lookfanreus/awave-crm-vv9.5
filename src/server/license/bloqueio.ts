import 'server-only'
import type { EngineBlockReason } from '@platform/lib/license-state'
import { readLicenseCache } from '@/server/license/cache'
import { getSecret } from '@/server/secrets'
import { motivoDeBloqueio } from '@/server/license/gate'
import { mensagemSegura } from '@/lib/sanitizar-erro'


const TTL_MS = 60_000


let memo: { ate: number; valor: Promise<EngineBlockReason | null> } | null = null


export function invalidarMemoBloqueio(): void {
  memo = null
}


export async function motivoDeBloqueioAtual(
  agora: number = Date.now(),
): Promise<EngineBlockReason | null> {
  if (memo && agora < memo.ate) return memo.valor

  const leitura = lerBloqueio(agora)
  memo = { ate: agora + TTL_MS, valor: leitura }
  return leitura
}


async function lerBloqueio(agora: number): Promise<EngineBlockReason | null> {
  let valor: EngineBlockReason | null = null
  try {
    const cache = await readLicenseCache()
    if (cache) {
      const ancora = await getSecret('first_activated_at')
      
      
      valor = motivoDeBloqueio(cache, ancora ? Date.parse(ancora) : null, agora)
    }
  } catch (erro) {
    
    
    
    
    
    
    
    console.error('[licenca] bloqueio: leitura falhou, liberando (fail-open)', mensagemSegura(erro))
    valor = null 
  }
  return valor
}
