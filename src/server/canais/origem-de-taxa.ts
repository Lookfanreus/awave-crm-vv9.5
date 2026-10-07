








import type { CanalEvent } from '@/server/canais/types'


function primeiroNaoVazio(...valores: Array<string | null | undefined>): string | null {
  for (const v of valores) {
    if (typeof v !== 'string') continue
    const limpo = v.trim()
    if (limpo.length > 0) return limpo
  }
  return null
}


export function chaveDeOrigem(evento: CanalEvent | undefined): string | null {
  if (!evento || evento.tipo !== 'mensagem') return null
  
  
  
  if (evento.origem === 'aparelho') return null
  return primeiroNaoVazio(evento.remetente, evento.identidadeExterna)
}


export interface LotePorOrigem {
  aceitos: CanalEvent[]
  descartados: number
}


export function filtrarPorOrigem(
  eventos: CanalEvent[],
  cabe: (chave: string) => boolean,
): LotePorOrigem {
  const aceitos: CanalEvent[] = []
  let descartados = 0
  for (const evento of eventos) {
    const chave = chaveDeOrigem(evento)
    if (chave === null) {
      aceitos.push(evento)
      continue
    }
    if (cabe(chave)) aceitos.push(evento)
    else descartados++
  }
  return { aceitos, descartados }
}
