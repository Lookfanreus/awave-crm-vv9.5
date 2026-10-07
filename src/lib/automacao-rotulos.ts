import { MAX_ACOES, type Gatilho, type Acao } from '@/lib/automacao-forma'



export const GATILHO_PT: Record<Gatilho, string> = {
  negocio_criado: 'Negócio criado',
  negocio_movido: 'Negócio movido de etapa',
  negocio_ganho: 'Negócio ganho',
  negocio_perdido: 'Negócio perdido',
  campo_alterado: 'Campo alterado',
  negocio_parado: 'Negócio parado numa etapa',
  atividade_vencida: 'Atividade venceu',
}

export const ACAO_PT: Record<Acao, string> = {
  mover_etapa: 'Mover para etapa',
  criar_atividade: 'Criar atividade',
  atribuir_responsavel: 'Atribuir responsável',
  chamar_webhook: 'Chamar webhook (avisar a IA)',
  atualizar_campo: 'Atualizar campo',
  criar_negocio: 'Criar negócio',
}

export const STATUS_NEGOCIO_PT: Record<'aberto' | 'ganho' | 'perdido', string> = {
  aberto: 'Aberto',
  ganho: 'Ganho',
  perdido: 'Perdido',
}

export function rotuloGatilho(gatilho: string): string {
  return (GATILHO_PT as Record<string, string>)[gatilho] ?? gatilho
}

export function rotuloAcao(tipo: string): string {
  return (ACAO_PT as Record<string, string>)[tipo] ?? tipo
}


export function descreverGatilho(
  gatilho: string,
  config: Record<string, unknown> | null | undefined,
  nomeEtapa: (id: string) => string | undefined,
): string {
  const base = rotuloGatilho(gatilho)
  if (gatilho !== 'negocio_movido' || !config) return base
  const de = typeof config.de_etapa_id === 'string' ? nomeEtapa(config.de_etapa_id) : undefined
  const para = typeof config.para_etapa_id === 'string' ? nomeEtapa(config.para_etapa_id) : undefined
  if (de && para) return `${base}: de "${de}" para "${para}"`
  if (para) return `${base} para "${para}"`
  if (de) return `${base} de "${de}"`
  return base
}


export const ERRO_AUTOMACAO_PT: Record<string, string> = {
  nome_obrigatorio: 'Dê um nome à automação.',
  gatilho_invalido: 'Escolha um gatilho válido.',
  sem_acao: 'Adicione ao menos uma ação.',
  acoes_demais: `No máximo ${MAX_ACOES} ações por automação.`,
  acao_invalida: 'Uma das ações não é reconhecida — remova e adicione de novo.',
  acao_config_incompleta: 'Preencha os campos obrigatórios de cada ação.',
  gatilho_config_incompleta: 'Preencha a configuração do gatilho (ex.: depois de quantos dias parado, ou qual campo observar).',
  forma_invalida: 'Revise os campos da automação.',
  alvo_invalido: 'A etapa ou funil escolhido não existe mais neste espaço de trabalho.',
  nao_encontrada: 'Automação não encontrada.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
  falha_salvar: 'Não foi possível salvar. Tente novamente.',
  falha_alternar: 'Não foi possível atualizar. Tente novamente.',
  falha_excluir: 'Não foi possível excluir. Tente novamente.',
}

export function traduzErroAutomacao(slug: string): string {
  return ERRO_AUTOMACAO_PT[slug] ?? 'Não foi possível concluir. Tente novamente.'
}
