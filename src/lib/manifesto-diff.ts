

export type StatusDivergencia = 'limpo' | 'divergente' | 'desconhecido'

export type RelatorioDivergencia = {
  status: StatusDivergencia
  
  modificados: string[]
  
  adicionados: string[]
  
  removidos: string[]
}

export const DESCONHECIDO: RelatorioDivergencia = {
  status: 'desconhecido',
  modificados: [],
  adicionados: [],
  removidos: [],
}


export const FORA_DA_COMPARACAO = [
  'src/server/awave-stamp.json',
  'src/server/awave-manifest.json',
]


export function compararManifesto(
  canonico: Record<string, string>,
  real: Record<string, string>,
  ignorar: string[] = FORA_DA_COMPARACAO,
): RelatorioDivergencia {
  const foraDeAnalise = new Set(ignorar)
  const modificados: string[] = []
  const adicionados: string[] = []
  const removidos: string[] = []

  for (const [caminho, sha] of Object.entries(canonico)) {
    if (foraDeAnalise.has(caminho)) continue
    const atual = real[caminho]
    if (atual === undefined) removidos.push(caminho)
    else if (atual !== sha) modificados.push(caminho)
  }

  for (const caminho of Object.keys(real)) {
    if (foraDeAnalise.has(caminho)) continue
    if (canonico[caminho] === undefined) adicionados.push(caminho)
  }

  modificados.sort()
  adicionados.sort()
  removidos.sort()

  const limpo =
    modificados.length === 0 && adicionados.length === 0 && removidos.length === 0

  return {
    status: limpo ? 'limpo' : 'divergente',
    modificados,
    adicionados,
    removidos,
  }
}


export function totalDivergente(r: RelatorioDivergencia): number {
  return r.modificados.length + r.adicionados.length + r.removidos.length
}


export function precisaDeBackup(r: RelatorioDivergencia): boolean {
  return r.status !== 'limpo'
}
