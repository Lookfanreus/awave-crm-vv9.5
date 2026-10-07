


export function precisaNegocioOrigem(mapa: Record<string, unknown>): boolean {
  return Object.values(mapa).some(
    (item) => !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).de === 'string',
  )
}


export function resolverMapaCampos(
  mapa: Record<string, unknown>,
  origem: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const [destino, bruto] of Object.entries(mapa)) {
    if (!bruto || typeof bruto !== 'object') continue
    const item = bruto as Record<string, unknown>
    if (typeof item.de === 'string') {
      if (item.de in origem) patch[destino] = origem[item.de]
    } else if ('literal' in item) {
      patch[destino] = item.literal
    }
  }
  return patch
}
