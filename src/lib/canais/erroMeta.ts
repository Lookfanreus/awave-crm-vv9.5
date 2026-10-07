

export type AcaoFalha = 'retentar' | 'desistir'


export type CausaSemResposta = 'rede' | 'timeout'


export function causaDaFalhaSemResposta(err: unknown): CausaSemResposta {
  const nome = (err as { name?: unknown } | null | undefined)?.name
  return nome === 'TimeoutError' || nome === 'AbortError' ? 'timeout' : 'rede'
}


export function classificarErroMeta(
  codigoHttp: number | null,
  _corpo?: string,
  causa: CausaSemResposta = 'rede',
): AcaoFalha {
  if (codigoHttp === null) return causa === 'timeout' ? 'desistir' : 'retentar'
  if (!Number.isFinite(codigoHttp)) return 'desistir' 
  if (codigoHttp === 429) return 'retentar'
  if (codigoHttp >= 500) return 'retentar'
  return 'desistir'
}
