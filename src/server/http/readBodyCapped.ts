









export const WEBHOOK_MAX_BYTES = 1_000_000


export interface CorpoCru {
  raw: string
  bytes: Uint8Array
}

export async function readBodyCapped(
  req: Request,
  teto: number = WEBHOOK_MAX_BYTES,
): Promise<({ ok: true } & CorpoCru) | { ok: false }> {
  
  
  
  
  
  
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > teto) return { ok: false }

  const corpo = req.body
  if (!corpo) return { ok: true, raw: '', bytes: new Uint8Array(0) }

  
  
  
  
  const leitor = corpo.getReader()
  const pedacos: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      total += value.byteLength
      if (total > teto) {
        await leitor.cancel()
        return { ok: false }
      }
      pedacos.push(value)
    }
  } catch {
    return { ok: false }
  }

  
  
  
  const buffer = new Uint8Array(total)
  let offset = 0
  for (const p of pedacos) {
    buffer.set(p, offset)
    offset += p.byteLength
  }
  return { ok: true, raw: new TextDecoder().decode(buffer), bytes: buffer }
}
