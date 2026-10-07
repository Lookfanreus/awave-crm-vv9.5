import type { LicenseCache, EngineBlockReason } from '@platform/lib/license-state'
import { engineBlockReason } from '@platform/lib/license-state'








export function motivoDeBloqueio(
  cache: LicenseCache,
  primeiraAtivacao: number | null,
  agora: number,
): EngineBlockReason | null {
  if (!cache) return null
  return engineBlockReason(cache, primeiraAtivacao, agora)
}
