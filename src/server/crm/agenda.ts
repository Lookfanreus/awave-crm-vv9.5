import 'server-only'


export function slugCanonico(slug: string): string {
  return slug === 'evento' ? 'reuniao' : slug
}

export type ComVencimento = { vencimento: string | null; concluida_em: string | null }


export function classificarVencimento(vencimento: string, agora: Date): 'atrasada' | 'hoje' | 'proxima' {
  const v = new Date(vencimento)
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const inicioAmanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1)
  if (v < inicioHoje) return 'atrasada'
  if (v < inicioAmanha) return 'hoje'
  return 'proxima'
}


export function proximaAtividade<T extends ComVencimento>(atividades: T[]): T | null {
  const abertas = atividades.filter((a) => a.vencimento != null && a.concluida_em == null)
  if (abertas.length === 0) return null
  return abertas.reduce((min, a) => (new Date(a.vencimento!) < new Date(min.vencimento!) ? a : min))
}

export type EstadoAgenda = 'atrasada' | 'planejada' | 'sem'


export function estadoAgendaNegocio(atividades: ComVencimento[], agora: Date = new Date()): EstadoAgenda {
  const proxima = proximaAtividade(atividades)
  if (!proxima?.vencimento) return 'sem'
  return classificarVencimento(proxima.vencimento, agora) === 'atrasada' ? 'atrasada' : 'planejada'
}
