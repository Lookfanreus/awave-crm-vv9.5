

export type AbaAgentes = 'agentes' | 'atendimento' | 'servidor'


export const ABA_PADRAO: AbaAgentes = 'agentes'

export const ROTULO_ABA: Record<AbaAgentes, string> = {
  agentes: 'Agentes',
  atendimento: 'Atendimento',
  servidor: 'Servidor',
}


export function abasDisponiveis({ servidor }: { servidor: boolean }): AbaAgentes[] {
  const abas: AbaAgentes[] = [ABA_PADRAO, 'atendimento']
  if (servidor) abas.push('servidor')
  return abas
}


export function resolverAba(
  bruta: string | string[] | undefined,
  disponiveis: AbaAgentes[],
): AbaAgentes {
  
  
  const pedida = Array.isArray(bruta) ? undefined : bruta
  return disponiveis.find((a) => a === pedida) ?? ABA_PADRAO
}


export function hrefDaAba(aba: AbaAgentes): string {
  return aba === ABA_PADRAO ? '/agentes' : `/agentes?aba=${aba}`
}
