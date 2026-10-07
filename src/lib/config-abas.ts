

export type AbaConfig = 'espaco' | 'pessoas' | 'servidor'


export const ABA_PADRAO: AbaConfig = 'espaco'


export const ROTULO_ABA: Record<AbaConfig, string> = {
  espaco: 'Espaço de trabalho',
  pessoas: 'Pessoas',
  servidor: 'Servidor',
}


export function abasDisponiveis({
  pessoas,
  servidor,
}: {
  
  pessoas: boolean
  
  servidor: boolean
}): AbaConfig[] {
  const abas: AbaConfig[] = [ABA_PADRAO]
  if (pessoas) abas.push('pessoas')
  if (servidor) abas.push('servidor')
  return abas
}


export function resolverAba(param: string | undefined, disponiveis: AbaConfig[]): AbaConfig {
  return disponiveis.find((a) => a === param) ?? ABA_PADRAO
}


export function hrefDaAba(aba: AbaConfig): string {
  return aba === ABA_PADRAO ? '/config' : `/config?aba=${aba}`
}
