


import { cortarNoTeto } from '@/lib/canais/grafema'
import { neutralizarCerca } from '@/lib/canais/historico-agente'

export type AchadoDaBase = { titulo: string; conteudo: string; tipo: 'fato' | 'playbook' }


const ROTULO: Record<AchadoDaBase['tipo'], string> = { fato: 'conhecimento', playbook: 'playbook' }


function rotuloDe(tipo: string): string {
  return Object.hasOwn(ROTULO, tipo) ? ROTULO[tipo as AchadoDaBase['tipo']] : ROTULO.fato
}

const NADA = '[conhecimento] Nada encontrado na base.'
const FORA = '[conhecimento] Base indisponivel agora.'


export const TETO_BLOCO_CONHECIMENTO = 8_000


export function montarBlocoConhecimento(estado: { achados: AchadoDaBase[] } | 'indisponivel'): string {
  if (estado === 'indisponivel') return FORA
  if (estado.achados.length === 0) return NADA
  const linhas = estado.achados.map(
    (a) => `[${rotuloDe(a.tipo)}] ${umaLinha(a.titulo)}: ${umaLinha(a.conteudo)}`,
  )
  return caberNoTeto(linhas).join('\n')
}


function caberNoTeto(linhas: string[]): string[] {
  const mantidas: string[] = []
  let total = 0
  for (const linha of linhas) {
    
    const custo = mantidas.length === 0 ? linha.length : linha.length + 1
    if (mantidas.length > 0 && total + custo > TETO_BLOCO_CONHECIMENTO) break
    mantidas.push(linha)
    total += custo
  }
  const unica = mantidas[0]
  if (mantidas.length === 1 && unica.length > TETO_BLOCO_CONHECIMENTO) {
    
    
    
    
    mantidas[0] = `${cortarNoTeto(unica, TETO_BLOCO_CONHECIMENTO - 1)}…`
  }
  return mantidas
}


function umaLinha(texto: string): string {
  return neutralizarCerca(texto).replace(/\s*[\r\n]+\s*/g, ' ').trim()
}
