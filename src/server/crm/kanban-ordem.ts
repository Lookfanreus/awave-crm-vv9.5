import { CrmEtapaDeOutroPipeline } from '@/server/crm/erros'




export type ColunasEstado = Record<string, string[]>

export type Drop = {
  cartaoId: string
  origemId: string
  destinoId: string
  
  indice: number
}


export type ResultadoDrop = {
  destinoId: string
  idsDestino: string[]
  origemId?: string
  idsOrigem?: string[]
}

export function aplicarDrop(colunas: ColunasEstado, drop: Drop): ResultadoDrop {
  const { cartaoId, origemId, destinoId, indice } = drop
  const origem = [...(colunas[origemId] ?? [])]
  const pos = origem.indexOf(cartaoId)
  if (pos === -1) throw new Error(`cartão ${cartaoId} não está na coluna ${origemId}`)

  if (origemId === destinoId) {
    origem.splice(pos, 1)
    origem.splice(clamp(indice, origem.length), 0, cartaoId)
    return { destinoId, idsDestino: origem }
  }

  origem.splice(pos, 1)
  const destino = [...(colunas[destinoId] ?? [])]
  destino.splice(clamp(indice, destino.length), 0, cartaoId)
  return { destinoId, idsDestino: destino, origemId, idsOrigem: origem }
}

function clamp(i: number, max: number): number {
  return Math.max(0, Math.min(i, max))
}


export function assertMesmoPipeline(pipelineNegocio: string, pipelineEtapa: string): void {
  if (pipelineNegocio !== pipelineEtapa) throw new CrmEtapaDeOutroPipeline()
}
