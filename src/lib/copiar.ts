























export const NAO_COPIEI_E_SELECIONEI =
  'Não consegui copiar daqui — o navegador não deixou. O texto já está selecionado acima: copie com Ctrl+C (no Mac, ⌘+C) antes de sair desta tela.'


export const NAO_COPIEI_NEM_SELECIONEI =
  'Não consegui copiar daqui — o navegador não deixou. Selecione o texto acima com o mouse e copie com Ctrl+C (no Mac, ⌘+C) antes de sair desta tela.'


export function fraseDeFalhaAoCopiar(selecionou: boolean): string {
  return selecionou ? NAO_COPIEI_E_SELECIONEI : NAO_COPIEI_NEM_SELECIONEI
}


export type AreaDeTransferencia = { writeText(texto: string): Promise<void> } | null | undefined


export async function copiarTexto(texto: string, area: AreaDeTransferencia): Promise<boolean> {
  if (!area || typeof area.writeText !== 'function') return false
  try {
    await area.writeText(texto)
    return true
  } catch {
    
    
    
    return false
  }
}


export function selecionarNaTela(id: string): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  const alvo = document.getElementById(id)
  const selecao = window.getSelection?.()
  if (!alvo || !selecao) return false
  const faixa = document.createRange()
  faixa.selectNodeContents(alvo)
  selecao.removeAllRanges()
  selecao.addRange(faixa)
  
  
  
  return selecao.rangeCount > 0 && !selecao.isCollapsed
}
