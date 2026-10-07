

export const GATILHOS = [
  'negocio_criado', 'negocio_movido', 'negocio_ganho', 'negocio_perdido',
  'campo_alterado', 'negocio_parado', 'atividade_vencida',
] as const
export type Gatilho = (typeof GATILHOS)[number]

export const ACOES = [
  'mover_etapa', 'criar_atividade', 'atribuir_responsavel', 'chamar_webhook',
  'atualizar_campo', 'criar_negocio',
] as const
export type Acao = (typeof ACOES)[number]



export const MAX_ACOES = 10

export type ItemAcao = { tipo: Acao } & Record<string, unknown>

export type Regra = {
  nome: string
  gatilho: string
  gatilho_config?: Record<string, unknown>
  condicoes?: unknown
  acoes: ItemAcao[]
}


const EXIGIDO: Record<Acao, string[]> = {
  mover_etapa: ['etapa_id'],
  criar_atividade: ['tipo_slug'],
  atribuir_responsavel: [],      
  chamar_webhook: [],            
  atualizar_campo: ['campo', 'valor'],
  criar_negocio: ['titulo'],
}


function gatilhoConfigCompleta(gatilho: string, cfg: Record<string, unknown>): boolean {
  if (gatilho === 'negocio_parado') return typeof cfg.dias === 'number' && cfg.dias > 0
  if (gatilho === 'campo_alterado') return typeof cfg.campo === 'string' && cfg.campo.trim() !== ''
  return true
}

export function validarForma(regra: Regra): string[] {
  const erros: string[] = []
  if (!regra.nome?.trim()) erros.push('nome_obrigatorio')
  if (!(GATILHOS as readonly string[]).includes(regra.gatilho)) erros.push('gatilho_invalido')
  if (!gatilhoConfigCompleta(regra.gatilho, regra.gatilho_config ?? {})) erros.push('gatilho_config_incompleta')
  if (!Array.isArray(regra.acoes) || regra.acoes.length === 0) erros.push('sem_acao')
  else if (regra.acoes.length > MAX_ACOES) erros.push('acoes_demais')

  for (const a of regra.acoes ?? []) {
    if (!(ACOES as readonly string[]).includes(a?.tipo)) { erros.push('acao_invalida'); continue }
    const faltando = EXIGIDO[a.tipo].some((k) => a[k] === undefined || a[k] === null || a[k] === '')
    if (faltando) erros.push('acao_config_incompleta')
  }
  return [...new Set(erros)]
}
