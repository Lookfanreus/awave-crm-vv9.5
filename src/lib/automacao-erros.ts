

export const ERROS_DETERMINISTICOS: ReadonlySet<string> = new Set([
  'campos_obrigatorios',
  'campo_invalido',
  'etapa_nao_encontrada',
  'etapa_de_outro_pipeline',
  'tipo_desconhecido',
  'acao_nao_implementada',
  'sem_negocio',
  'sem_alvo',
  'negocio_nao_encontrado',
])


export function ehFalhaDeterministica(slug: string | null | undefined): boolean {
  return !!slug && ERROS_DETERMINISTICOS.has(slug)
}
