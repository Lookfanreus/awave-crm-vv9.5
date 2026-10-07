import 'server-only'
import { getSecret } from '@/server/secrets'
import { readLicenseCache } from '@/server/license/cache'
import { motivoDeBloqueio } from '@/server/license/gate'
import { getLicenseState, type EngineBlockReason } from '@platform/lib/license-state'


export type VistaDaLicenca = {
  
  temChave: boolean
  
  mascara: string | null
  
  situacao:
    | 'sem_licenca' | 'ativa' | 'expirada' | 'revogada'
    | 'em_outra_maquina' | 'nunca_validou' | 'sem_confirmacao'
  
  validaAte: string | null
  
  ultimaResposta: string | null
  
  comprador: string | null
  
  bloqueio: EngineBlockReason | null
}


export function mascarar(chave: string): string {
  const c = chave.trim()
  if (c.length < 12) return '•'.repeat(8)
  return `${c.slice(0, 6)}…${c.slice(-4)}`
}


export async function estadoDaLicenca(): Promise<VistaDaLicenca> {
  const chave = await getSecret('license_key')
  const cache = await readLicenseCache()

  if (!chave) {
    return {
      temChave: false, mascara: null, situacao: 'sem_licenca',
      validaAte: null, ultimaResposta: null, comprador: null, bloqueio: null,
    }
  }

  const base = { temChave: true as const, mascara: mascarar(chave) }

  
  
  
  
  if (!cache) {
    return { ...base, situacao: 'nunca_validou', validaAte: null, ultimaResposta: null, comprador: null, bloqueio: null }
  }

  const agora = Date.now()
  const primeiraAtivacao = await getSecret('first_activated_at')
  const situacaoPlataforma = getLicenseState(cache, agora)

  const mapa: Record<string, VistaDaLicenca['situacao']> = {
    active: 'ativa',
    expired: 'expirada',
    revoked: 'revogada',
    in_use_elsewhere: 'em_outra_maquina',
    never_verified: 'nunca_validou',
    
    
    
    unverified: 'sem_confirmacao',
  }

  return {
    ...base,
    situacao: mapa[situacaoPlataforma] ?? 'nunca_validou',
    validaAte: cache.club_incluso_ate ?? null,
    ultimaResposta: cache.last_ok_at ?? null,
    comprador: cache.buyer_name || null,
    bloqueio: motivoDeBloqueio(cache, primeiraAtivacao ? Date.parse(primeiraAtivacao) : null, agora),
  }
}
