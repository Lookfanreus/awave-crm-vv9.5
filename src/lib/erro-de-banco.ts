


export function codigoDeBanco(erro: unknown): string | null {
  try {
    if (!erro || typeof erro !== 'object') return null
    const c = (erro as { code?: unknown }).code
    return typeof c === 'string' && c.length > 0 ? c : null
  } catch {
    return null
  }
}


const CONFLITO =
  'Isso entrou em conflito com algo que já existe aqui — normalmente porque outra pessoa salvou ao mesmo tempo. Recarregue a página e tente de novo.'


const VALOR_RECUSADO =
  'Um dos valores deste formulário não foi aceito. Confira os campos e encurte os textos muito longos — depois tente de novo.'


const REFERENCIA_SUMIU =
  'Algo que esta tela aponta não existe mais neste espaço de trabalho. Recarregue a página e tente de novo.'


const NAO_DEU =
  'Não consegui concluir isso agora. Tente de novo em alguns instantes. Se continuar assim, o motivo fica registrado no servidor — fale com quem instalou o CRM.'


export function fraseDeBanco(erro: unknown): string {
  switch (codigoDeBanco(erro)) {
    case '23505':
      return CONFLITO
    case '23514':
      return VALOR_RECUSADO
    case '23503':
      return REFERENCIA_SUMIU
    default:
      return NAO_DEU
  }
}


export const FRASES_DE_BANCO = {
  conflito: CONFLITO,
  valorRecusado: VALOR_RECUSADO,
  referenciaSumiu: REFERENCIA_SUMIU,
  naoDeu: NAO_DEU,
} as const
