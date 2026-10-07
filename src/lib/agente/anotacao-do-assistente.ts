











export const TETO_ANOTACAO = 500


const PREFIXO = 'ia'


const DIGITOS_DO_RESUMO = 16


export function sanitizarAnotacao(bruto: unknown, teto: number = TETO_ANOTACAO): string {
  if (typeof bruto !== 'string') return ''
  const semMarcacao = bruto.replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ')
  // eslint-disable-next-line no-control-regex
  const semControle = semMarcacao.replace(/[\u0000-\u001F\u007F]/g, ' ')
  return semControle.replace(/\s+/g, ' ').trim().slice(0, Math.max(0, teto))
}


export function chaveDaAnotacao(conversaId: string, resumo: string): string {
  return `${PREFIXO}:${conversaId}:${resumo.slice(0, DIGITOS_DO_RESUMO)}`
}


export function prefixoDaConversa(conversaId: string): string {
  return `${PREFIXO}:${conversaId}:`
}
