import 'server-only'
import { getSecret, setSecret } from '@/server/secrets'
import { revalidarLicenca } from '@/server/license/validar'


export const INTERVALO_LICENCA_MS = 6 * 60 * 60 * 1000 

const CHAVE_ULTIMA = 'license_last_beat_at'


export function deveBater(ultimaISO: string | null, agora: number, intervalo = INTERVALO_LICENCA_MS): boolean {
  if (!ultimaISO) return true
  const t = Date.parse(ultimaISO)
  
  
  if (!Number.isFinite(t) || t > agora) return true
  return agora - t >= intervalo
}


export async function baterLicenca(agora = Date.now()): Promise<{ bateu: boolean }> {
  try {
    if (!(await getSecret('license_key'))) return { bateu: false } 
    if (!deveBater(await getSecret(CHAVE_ULTIMA), agora)) return { bateu: false }

    
    
    await setSecret(CHAVE_ULTIMA, new Date(agora).toISOString())
    await revalidarLicenca()
    return { bateu: true }
  } catch {
    return { bateu: false }
  }
}
