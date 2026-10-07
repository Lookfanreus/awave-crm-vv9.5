import 'server-only'
import type { LicenseCache } from '@platform/lib/license-state'
import { getSecret, setSecret } from '@/server/secrets'

const KEY = 'license_cache'

export function parseLicenseCache(raw: string | null): LicenseCache {
  if (!raw) return null
  try { return JSON.parse(raw) as NonNullable<LicenseCache> } catch { return null }
}

export async function readLicenseCache(): Promise<LicenseCache> {
  return parseLicenseCache(await getSecret(KEY))
}

export async function writeLicenseCache(cache: NonNullable<LicenseCache>): Promise<void> {
  await setSecret(KEY, JSON.stringify(cache))
}
