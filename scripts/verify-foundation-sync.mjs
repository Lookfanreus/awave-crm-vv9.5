


import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { sha256 } from './sync-foundation.mjs'

const CRM = dirname(dirname(fileURLToPath(import.meta.url)))

export async function verificarSync({ lockOverride } = {}) {
  const lock = lockOverride ?? JSON.parse(await readFile(join(CRM, 'platform/FOUNDATION.lock'), 'utf8'))
  const divergencias = []
  for (const [dstRel, meta] of Object.entries(lock.files)) {
    let atual = null
    try { atual = sha256(await readFile(join(CRM, dstRel))) } catch { atual = null }
    if (atual !== meta.sha256) divergencias.push(dstRel)
  }
  return { ok: divergencias.length === 0, divergencias }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verificarSync().then((r) => {
    if (r.ok) { console.log('✓ fundação sincronizada'); process.exit(0) }
    console.error('✗ DRIFT da fundação vendored:', r.divergencias.join(', '))
    console.error('  Rode `pnpm sync:foundation` ou reverta a edição manual em platform/.')
    process.exit(1)
  })
}
