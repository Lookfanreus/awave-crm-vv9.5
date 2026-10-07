

import { validarValor, type DefCampo } from '@/lib/campos-valor'


export const LIMITE_LINHAS = 5000


export type Mapeamento = Record<number, string>

export type LinhaPlano = {
  
  indice: number
  fixos: Record<string, unknown>
  campos: Record<string, unknown>
  erros: string[]
}

export function planejar(
  linhas: string[][],
  mapa: Mapeamento,
  defs: DefCampo[],
  fixosValidos: string[],
): LinhaPlano[] {
  const porSlug = new Map(defs.map((d) => [d.slug, d]))
  const plano: LinhaPlano[] = []

  for (let i = 1; i < linhas.length; i++) {   
    const linha = linhas[i]
    const item: LinhaPlano = { indice: i + 1, fixos: {}, campos: {}, erros: [] }

    for (const [colStr, destino] of Object.entries(mapa)) {
      const bruto = (linha[Number(colStr)] ?? '').trim()
      if (bruto === '') continue                        

      if (destino.startsWith('fixo:')) {
        const nome = destino.slice(5)
        if (!fixosValidos.includes(nome)) { item.erros.push(`coluna mapeada para campo desconhecido: ${nome}`); continue }
        item.fixos[nome] = bruto
        continue
      }
      if (destino.startsWith('campo:')) {
        const slug = destino.slice(6)
        const def = porSlug.get(slug)
        if (!def) { item.erros.push(`campo desconhecido: ${slug}`); continue }
        const r = validarValor(def, bruto)
        if (!r.ok) { item.erros.push(`${slug}: ${r.erro}`); continue }
        if (r.valor !== undefined) item.campos[slug] = r.valor
      }
    }
    plano.push(item)
  }
  return plano
}
