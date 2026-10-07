












export interface Balde {
  
  capacidade: number
  
  recargaPorMs: number
  
  teto: number
}

export interface EstadoBalde {
  tokens: number
  emMs: number
}


export const BALDE_CANAL: Balde = { capacidade: 60, recargaPorMs: 2 / 1000, teto: 500 }


export const BALDE_ORIGEM: Balde = { capacidade: 20, recargaPorMs: 0.5 / 1000, teto: 10_000 }


export const BALDE_CONTATO_NOVO: Balde = { capacidade: 30, recargaPorMs: 30 / 3_600_000, teto: 500 }


function tokensAgora(balde: Balde, estado: EstadoBalde | undefined, agoraMs: number): number {
  if (estado === undefined) return balde.capacidade
  return Math.min(balde.capacidade, estado.tokens + (agoraMs - estado.emMs) * balde.recargaPorMs)
}


function podar(estados: Map<string, EstadoBalde>, balde: Balde, agoraMs: number): void {
  if (estados.size <= balde.teto) return

  
  for (const [chave, e] of estados) {
    if (tokensAgora(balde, e, agoraMs) >= balde.capacidade) estados.delete(chave)
  }

  const alvo = Math.max(1, Math.floor(balde.teto * 0.9))
  if (estados.size <= alvo) return

  const porTokens = [...estados].sort(
    (a, b) => tokensAgora(balde, b[1], agoraMs) - tokensAgora(balde, a[1], agoraMs),
  )
  for (const [chave] of porTokens) {
    if (estados.size <= alvo) break
    estados.delete(chave)
  }
}


export function consumir(
  estados: Map<string, EstadoBalde>,
  balde: Balde,
  chave: string,
  agoraMs: number,
): boolean {
  const tokens = tokensAgora(balde, estados.get(chave), agoraMs)

  if (tokens < 1) {
    
    estados.set(chave, { tokens, emMs: agoraMs })
    return false
  }
  estados.set(chave, { tokens: tokens - 1, emMs: agoraMs })
  podar(estados, balde, agoraMs)
  return true
}
