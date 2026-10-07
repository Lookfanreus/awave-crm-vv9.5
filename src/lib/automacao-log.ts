import { rotuloAcao } from '@/lib/automacao-rotulos'



export type EstadoExecucao = 'pendente' | 'ok' | 'erro' | 'desistido' | 'cancelado'
export type TomExecucao = 'ok' | 'erro' | 'neutro' | 'pendente'
export type ResumoExecucao = { texto: string; tom: TomExecucao }


const ERRO_ACAO_PT: Record<string, string> = {
  tipo_desconhecido: 'tipo de atividade desconhecido',
  sem_alvo: 'sem negócio ou contato alvo',
  sem_negocio: 'sem negócio para aplicar a ação',
  sem_membros: 'nenhum membro no espaço de trabalho para atribuir',
  acao_nao_implementada: 'ação ainda não disponível nesta versão',
  campos_obrigatorios: 'campos obrigatórios da etapa não preenchidos',
  campo_invalido: 'valor do campo customizado inválido',
  negocio_nao_encontrado: 'negócio não encontrado',
  etapa_nao_encontrada: 'etapa não encontrada',
  etapa_de_outro_pipeline: 'etapa pertence a outro funil',
  erro_inesperado: 'erro inesperado',
}

const MOTIVO_CANCELADO_PT: Record<string, string> = {
  disjuntor_aberto: 'Pausada: excesso de execuções no mesmo negócio (disjuntor)',
  
  
  
  
  
  
  
  cadeia_profunda: 'Pausada: cadeia de automações longa demais (uma automação disparou a próxima, elo após elo)',
  
  
  
  disjuntor_automacao_aberto: 'Pausada: excesso de execuções desta automação (disjuntor por automação)',
  automacao_inativa: 'Cancelada: a automação foi desligada antes de rodar',
  alvo_removido: 'Cancelada: o negócio ou a etapa não existe mais',
}

type AcaoResultado = { ok?: boolean; erro?: string; detalhe?: unknown }

function comoObjeto(resultado: unknown): Record<string, unknown> {
  return resultado && typeof resultado === 'object' ? (resultado as Record<string, unknown>) : {}
}

function descreverFalhaAcao(falha: AcaoResultado | undefined, ultimoErro: string | null): string {
  const slug = falha?.erro ?? ultimoErro ?? undefined
  if (!slug) return 'motivo desconhecido'
  let texto = ERRO_ACAO_PT[slug] ?? slug
  
  
  
  if (slug === 'campos_obrigatorios' || slug === 'campo_invalido') {
    const detalhe = falha?.detalhe as { slugs?: unknown } | undefined
    if (Array.isArray(detalhe?.slugs) && detalhe.slugs.length > 0) {
      texto += ` (${detalhe.slugs.join(', ')})`
    }
  }
  return texto
}


function detalharFalha(
  r: Record<string, unknown>,
  ultimoErro: string | null,
  acoesRegra?: Array<{ tipo: string }>,
): { sufixo: string; motivoTxt: string } {
  const acoes = Array.isArray(r.acoes) ? (r.acoes as AcaoResultado[]) : []
  const idxFalha = acoes.findIndex((a) => a && a.ok === false)
  const falha = idxFalha >= 0 ? acoes[idxFalha] : undefined
  
  
  
  const nomeAcao = idxFalha >= 0 && acoesRegra?.[idxFalha] ? `"${rotuloAcao(acoesRegra[idxFalha].tipo)}"` : null
  return { sufixo: nomeAcao ? ` em ${nomeAcao}` : '', motivoTxt: descreverFalhaAcao(falha, ultimoErro) }
}


export function resumirExecucao(
  estado: EstadoExecucao,
  resultado: unknown,
  ultimoErro: string | null,
  acoesRegra?: Array<{ tipo: string }>,
  tentativas?: number,
): ResumoExecucao {
  const r = comoObjeto(resultado)

  if (estado === 'pendente') {
    const n = tentativas ?? 0
    if (n <= 0) return { texto: 'Aguardando — roda em até 1 minuto', tom: 'pendente' }
    
    
    
    const { sufixo, motivoTxt } = detalharFalha(r, ultimoErro, acoesRegra)
    return { texto: `Falhou${sufixo} (tentativa ${n}) — vai tentar de novo: ${motivoTxt}`, tom: 'erro' }
  }

  if (estado === 'cancelado') {
    const motivo = typeof r.motivo === 'string' ? r.motivo : undefined
    return { texto: (motivo && MOTIVO_CANCELADO_PT[motivo]) ?? 'Cancelada', tom: 'neutro' }
  }

  if (estado === 'ok') {
    if (r.condicao === false) return { texto: 'Condição não bateu', tom: 'neutro' }
    const acoes = Array.isArray(r.acoes) ? r.acoes.length : null
    const texto = acoes !== null
      ? `Executada — ${acoes} ${acoes === 1 ? 'ação' : 'ações'}`
      : 'Executada com sucesso'
    return { texto, tom: 'ok' }
  }

  
  
  
  
  
  
  
  const { sufixo, motivoTxt } = detalharFalha(r, ultimoErro, acoesRegra)
  if (estado === 'erro') return { texto: `Falhou${sufixo}: ${motivoTxt}`, tom: 'erro' }
  const n = tentativas ?? 0
  
  
  
  
  if (n === 1) {
    return { texto: `Parou${sufixo}: ${motivoTxt} — erro de configuração, não adianta tentar de novo`, tom: 'erro' }
  }
  const quantas = n > 1 ? `após ${n} tentativas` : 'após várias tentativas'
  return { texto: `Desistiu (${quantas})${sufixo}: ${motivoTxt}`, tom: 'erro' }
}


export function podeAtribuirAAutomacao(estado: EstadoExecucao, resultado: unknown): boolean {
  if (estado !== 'cancelado') return true
  const r = comoObjeto(resultado)
  return r.motivo !== 'disjuntor_aberto'
}


export function avisoDisjuntor(motivos: Array<string | null | undefined>): string | null {
  const porNegocio = motivos.includes('disjuntor_aberto')
  const porCadeia = motivos.includes('cadeia_profunda') || motivos.includes('disjuntor_automacao_aberto')
  if (porNegocio && porCadeia) {
    return 'Uma ou mais automações entraram em pausa por travas de segurança (execuções demais e cadeia encadeada longa demais).'
  }
  if (porCadeia) {
    return 'Uma automação entrou em pausa: a cadeia de automações encadeadas ficou longa demais — uma disparou a próxima, elo após elo (trava de segurança).'
  }
  if (porNegocio) {
    return 'Uma automação entrou em pausa por excesso de execuções no mesmo negócio.'
  }
  return null
}
