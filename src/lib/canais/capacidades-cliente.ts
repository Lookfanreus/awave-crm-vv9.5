


















export const CAPACIDADES_CLIENTE: Record<string, { janela24h: boolean }> = {
  uazapi: { janela24h: false },
  simulador: { janela24h: false },
  whatsapp_cloud: { janela24h: true },
  
  
  
  
  instagram: { janela24h: true },
}


export function temJanela24h(provider: string): boolean {
  if (typeof provider !== 'string') return false
  return Object.hasOwn(CAPACIDADES_CLIENTE, provider) && CAPACIDADES_CLIENTE[provider].janela24h === true
}
