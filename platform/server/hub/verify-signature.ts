// Ed25519 verification of the Hub's /validate `active` verdict (Layer 2.1, Phase B).
//
// Closes the cheapest bypass: today a fake Hub (point HUB_URL at a 10-line mock)
// returns `{status:'active',entitled:true}` and unlocks the firehose forever. With
// this, an `active` verdict is trusted ONLY if it carries a valid Ed25519 signature
// from the real Hub's PRIVATE key (server-side only). The public keys below are the
// verifiers — PUBLIC = safe to ship in the buyer's copy.
//
// FAIL-OPEN, NEVER BRICKS: the caller (validateLicense) treats a failed/missing
// signature exactly like being OFFLINE — it preserves the previous cache and serves
// the 5-day grace. Worst case for a real buyer (e.g. the Hub briefly stops signing)
// is the firehose degrading after grace; the engine keeps running (`engineBlockReason`
// is untouched). The signature binds the verdict to `instance_id`, so a captured
// signature can't be replayed to a different install (the resale vector).
//
// ROTATION: ship >1 public key — any key that verifies is accepted. To rotate, add
// the new public key here FIRST (a Motor update), then switch the Hub's private key.

import { verify as edVerify, createPublicKey, type KeyObject } from 'node:crypto'

/** Public keys the real Hub signs `active` verdicts with. Generated 2026-07-15. */
const PUBLIC_KEYS_PEM: string[] = [
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAbFxSZSVYOstxOh4YLM6YvDJNFwWrRz3S1u6XpoTSTB8=\n-----END PUBLIC KEY-----',
]

// Parse once at module load. A malformed PEM is skipped (never crashes the Motor).
const PUBLIC_KEYS: KeyObject[] = PUBLIC_KEYS_PEM.flatMap((pem) => {
  try {
    return [createPublicKey(pem)]
  } catch {
    return []
  }
})

/**
 * Canonical bytes the Hub signed. Versioned + pipe-delimited — MUST byte-match, byte for
 * byte, what the Hub's own `canonicalActivePayload` builds before signing: same field
 * order, same `|` delimiter, same `v1` prefix. The signature covers exactly these bytes,
 * so any drift between the two sides makes EVERY signature fail to verify — silently,
 * since the caller then behaves as if it were offline (see FAIL-OPEN above). Change one
 * side and you change the other in the same release; a shape change bumps the `v1` prefix
 * so old and new are never mistaken for each other.
 */
export function canonicalActivePayload(f: {
  status: string
  entitled: boolean
  instanceId: string | null | undefined
  iat: number
}): string {
  return `v1|${f.status}|${f.entitled ? 1 : 0}|${f.instanceId ?? ''}|${f.iat}`
}

/**
 * `true` iff a shipped public key verifies the Hub's signature over the `active`
 * verdict. Missing sig/iat, no configured keys, or any crypto error → `false`
 * (the caller then treats it as offline). NEVER throws. `publicKeys` is injectable
 * for tests; production uses the embedded keys.
 */
export function verifyActiveSignature(
  f: {
    status: string
    entitled: boolean
    instanceId: string | null | undefined
    sig: string | undefined
    sigIat: number | undefined
  },
  publicKeys: KeyObject[] = PUBLIC_KEYS,
): boolean {
  if (!f.sig || typeof f.sigIat !== 'number' || publicKeys.length === 0) return false
  try {
    const msg = Buffer.from(
      canonicalActivePayload({ status: f.status, entitled: f.entitled, instanceId: f.instanceId, iat: f.sigIat }),
      'utf8',
    )
    const sig = Buffer.from(f.sig, 'base64')
    return publicKeys.some((k) => {
      try {
        return edVerify(null, msg, k, sig)
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}
