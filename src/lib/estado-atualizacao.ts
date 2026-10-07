

export type FaseAtualizacao =
  | 'baixando'
  | 'extraindo'
  | 'publicando'
  | 'aguardando_rebuild'
  | 'erro'

export type EstadoDaAtualizacao = {
  fase: FaseAtualizacao
  
  alvo: string
  
  em: string
  
  erro?: string
}


export function estaEmAndamento(e: EstadoDaAtualizacao | null): boolean {
  if (!e) return false
  return e.fase === 'baixando' || e.fase === 'extraindo' || e.fase === 'publicando'
}


export const LIMITE_DE_ANDAMENTO_MS = 15 * 60 * 1000


export function estaPreso(
  e: EstadoDaAtualizacao | null,
  agoraMs: number = Date.now(),
): boolean {
  if (!estaEmAndamento(e)) return false
  const marcado = Date.parse(e!.em)
  
  
  
  if (Number.isNaN(marcado)) return true
  return agoraMs - marcado > LIMITE_DE_ANDAMENTO_MS
}


export function esperaDoRebuildTerminou(
  e: EstadoDaAtualizacao | null,
  inicioDoProcessoMs: number,
): boolean {
  if (!e || e.fase !== 'aguardando_rebuild') return false
  return carimboEhDeOutroProcesso(e, inicioDoProcessoMs)
}


function carimboEhDeOutroProcesso(e: EstadoDaAtualizacao, inicioDoProcessoMs: number): boolean {
  const marcado = Date.parse(e.em)
  if (Number.isNaN(marcado)) return true
  return inicioDoProcessoMs > marcado
}


export function erroEhDeOutroContainer(
  e: EstadoDaAtualizacao | null,
  inicioDoProcessoMs: number,
): boolean {
  if (!e || e.fase !== 'erro') return false
  return carimboEhDeOutroProcesso(e, inicioDoProcessoMs)
}


export type TipoGatilho = 'disparado' | 'falhou' | 'ausente'

export type ResultadoGatilho = {
  tipo: TipoGatilho
  
  detalhe?: string
  em: string
}

const TIPOS_GATILHO: readonly string[] = ['disparado', 'falhou', 'ausente']


export function lerResultadoGatilho(bruto: string | null): ResultadoGatilho | null {
  if (!bruto) return null
  try {
    const o = JSON.parse(bruto) as Partial<ResultadoGatilho>
    if (typeof o?.tipo !== 'string' || !TIPOS_GATILHO.includes(o.tipo)) return null
    return {
      tipo: o.tipo as TipoGatilho,
      em: typeof o.em === 'string' ? o.em : '',
      ...(typeof o.detalhe === 'string' ? { detalhe: o.detalhe } : {}),
    }
  } catch {
    return null
  }
}


export function lerEstado(bruto: string | null): EstadoDaAtualizacao | null {
  if (!bruto) return null
  try {
    const o = JSON.parse(bruto) as Partial<EstadoDaAtualizacao>
    if (typeof o?.fase !== 'string' || typeof o?.alvo !== 'string') return null
    return {
      fase: o.fase as FaseAtualizacao,
      alvo: o.alvo,
      em: typeof o.em === 'string' ? o.em : '',
      ...(typeof o.erro === 'string' ? { erro: o.erro } : {}),
    }
  } catch {
    return null
  }
}
