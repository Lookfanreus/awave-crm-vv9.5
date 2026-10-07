




import { z } from 'zod'


export const DIMENSAO_DO_ESQUEMA = 1536


export const DIMENSOES_CONHECIDAS: Readonly<Record<string, number>> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}


function dimensaoConhecida(modelo: string): number | undefined {
  return typeof modelo === 'string' && Object.hasOwn(DIMENSOES_CONHECIDAS, modelo)
    ? DIMENSOES_CONHECIDAS[modelo]
    : undefined
}

export function conferirDimensao(
  modelo: string,
): { ok: true } | { ok: false; esperada: number; achada: number } {
  const achada = dimensaoConhecida(modelo)
  if (achada === undefined || achada === DIMENSAO_DO_ESQUEMA) return { ok: true }
  return { ok: false, esperada: DIMENSAO_DO_ESQUEMA, achada }
}


export function carimbo(modelo: string, dimensao = dimensaoConhecida(modelo) ?? DIMENSAO_DO_ESQUEMA): string {
  return `openai:${modelo}:${dimensao}`
}


export const TETO_TITULO = 120
export const TETO_CONTEUDO = 4000


export const TETO_REPROCESSO_POR_CLIQUE = 20


export const tipoSchema = z.enum(['fato', 'playbook'])
export const origemSchema = z.enum(['operador', 'aprendizado'])

export type TipoDaEntrada = z.infer<typeof tipoSchema>
export type OrigemDaEntrada = z.infer<typeof origemSchema>


export const ORIGEM_DO_OPERADOR: OrigemDaEntrada = 'operador'

export const entradaSchema = z.object({
  titulo: z.string().trim().min(1).max(TETO_TITULO),
  conteudo: z.string().trim().min(1).max(TETO_CONTEUDO),
  tipo: tipoSchema,
})

export type EntradaDaBase = z.infer<typeof entradaSchema>

export function validarEntrada(
  bruto: unknown,
): { ok: true; valor: EntradaDaBase } | { ok: false; erro: string } {
  
  
  const r = entradaSchema.safeParse(bruto)
  if (r.success) return { ok: true, valor: r.data }
  const primeiro = r.error.issues[0]
  const campo = String(primeiro?.path?.[0] ?? 'campo')
  const teto = campo === 'titulo' ? TETO_TITULO : TETO_CONTEUDO
  if (primeiro?.code === 'too_big') {
    return { ok: false, erro: `O ${campo} passa do limite de ${teto} caracteres.` }
  }
  if (primeiro?.code === 'too_small') return { ok: false, erro: `Preencha o ${campo}.` }
  return { ok: false, erro: `Valor inválido em ${campo}.` }
}


export function contarBlocosVisiveis(
  blocosHabilitadosIds: readonly string[],
  recorte: ReadonlyArray<{ assistenteId: string; blocoId: string }>,
  assistentesIds: readonly string[],
): Record<string, number> {
  const habilitados = new Set(blocosHabilitadosIds)
  const restritos = new Map<string, Set<string>>()
  for (const r of recorte) {
    if (!habilitados.has(r.blocoId)) continue
    const atual = restritos.get(r.blocoId) ?? new Set<string>()
    atual.add(r.assistenteId)
    restritos.set(r.blocoId, atual)
  }

  const contagem = Object.fromEntries(assistentesIds.map((id) => [id, 0])) as Record<string, number>
  for (const blocoId of habilitados) {
    const restricao = restritos.get(blocoId)
    for (const id of assistentesIds) {
      
      if (!restricao || restricao.has(id)) contagem[id] += 1
    }
  }
  return contagem
}


export function contarBlocosExclusivos(
  blocosHabilitadosIds: readonly string[],
  recorte: ReadonlyArray<{ assistenteId: string; blocoId: string }>,
  assistentesIds: readonly string[],
): Record<string, number> {
  const habilitados = new Set(blocosHabilitadosIds)
  const restritos = new Map<string, Set<string>>()
  for (const r of recorte) {
    if (!habilitados.has(r.blocoId)) continue
    const atual = restritos.get(r.blocoId) ?? new Set<string>()
    atual.add(r.assistenteId)
    restritos.set(r.blocoId, atual)
  }

  const contagem = Object.fromEntries(assistentesIds.map((id) => [id, 0])) as Record<string, number>
  for (const restricao of restritos.values()) {
    
    if (restricao.size !== 1) continue
    const [unico] = restricao
    if (unico !== undefined && unico in contagem) contagem[unico] += 1
  }
  return contagem
}


export function fraseDeExclusaoDaEntrada(habilitado: boolean): string {
  const some = 'O texto some da base e o assistente deixa de saber isto.'
  const desligar =
    'Se você só quer parar de usar por um tempo, Desligar tira a entrada das respostas e mantém o texto escrito aqui.'
  const nunca = 'Isso não tem volta.'
  return habilitado ? `${some} ${desligar} ${nunca}` : `${some} ${nunca}`
}
