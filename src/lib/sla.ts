


export const SLA_ESQUEMA_REVISAO = '6dnseusid222hv1t8rekjq6kc' as const

export type EstadoSla = 'sem' | 'ok' | 'atencao' | 'estourado'


export function diasNaEtapa(etapaDesde: string, agora: Date): number {
  const ms = agora.getTime() - new Date(etapaDesde).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}


export function estadoSla(etapaDesde: string, slaDias: number | null, agora: Date): EstadoSla {
  if (slaDias == null || slaDias <= 0) return 'sem'
  const dias = diasNaEtapa(etapaDesde, agora)
  if (dias > slaDias) return 'estourado'
  if (dias >= slaDias * 0.8) return 'atencao'
  return 'ok'
}
