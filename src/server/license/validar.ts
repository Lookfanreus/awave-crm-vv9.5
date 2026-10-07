import 'server-only'
import type { LicenseCache } from '@platform/lib/license-state'
import { getSecret, setSecret } from '@/server/secrets'
import { readLicenseCache, writeLicenseCache } from '@/server/license/cache'
import { verifyActiveSignature } from '@platform/server/hub/verify-signature'


export function urlDoHub(): string {
  return (process.env.HUB_URL ?? 'https://elitedaia.com.br').replace(/\/+$/, '')
}


export function desembrulhar(corpo: unknown): Record<string, unknown> {
  if (!corpo || typeof corpo !== 'object') return {}
  const obj = corpo as Record<string, unknown>
  if ('status' in obj) return obj
  const dentro = obj.data
  if (dentro && typeof dentro === 'object') return dentro as Record<string, unknown>
  return obj
}

const STATUS_CONHECIDOS = ['active', 'revoked', 'in_use_elsewhere']


export function proximoHardBlock(
  status: string,
  blockDaResposta: unknown,
  anterior: LicenseCache,
): boolean {
  if (status === 'active') return false
  if (blockDaResposta === 'hard') return true
  return anterior?.hard_block === true
}


export async function revalidarLicenca(): Promise<void> {
  try {
    const licenseKey = await getSecret('license_key')
    if (!licenseKey) return

    
    
    
    let instanceId = await getSecret('instance_id')
    if (!instanceId) {
      instanceId = crypto.randomUUID()
      await setSecret('instance_id', instanceId)
    }

    const resp = await fetch(`${urlDoHub()}/api/hub/validate-crm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey, instance_id: instanceId }),
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return

    const v = desembrulhar(await resp.json())
    const status = typeof v.status === 'string' ? v.status : ''
    if (!STATUS_CONHECIDOS.includes(status)) return

    
    
    if (status === 'active') {
      const ok = verifyActiveSignature({
        status: 'active',
        entitled: !!v.entitled,
        instanceId,
        sig: v.sig as string | undefined,
        sigIat: v.sig_iat as number | undefined,
      })
      if (!ok) return
    }

    
    
    
    if (status === 'active' && !(await getSecret('first_activated_at'))) {
      await setSecret('first_activated_at', new Date().toISOString())
    }

    
    
    const anterior = await readLicenseCache()

    await writeLicenseCache({
      hub_status: status as 'active' | 'revoked' | 'in_use_elsewhere',
      entitled: !!v.entitled,
      
      
      
      ...(typeof v.club_incluso_ate === 'string' ? { club_incluso_ate: v.club_incluso_ate } : {}),
      
      
      
      
      
      
      
      ...(typeof v.latest_version === 'string' ? { latest_version: v.latest_version } : {}),
      buyer_name: (v.buyer_name as string | undefined) ?? '',
      last_ok_at: new Date().toISOString(),
      hard_block: proximoHardBlock(status, v.block, anterior),
    })
  } catch {
    
  }
}
