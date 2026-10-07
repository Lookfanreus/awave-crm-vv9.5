









import type {
  CanalAdapter,
  CanalEvent,
  EnvioResultado,
} from '@/server/canais/types'


const PREFIXO_DE_SAIDA = 'sim-out:'


function novoIdDeSaida(): string {
  return `${PREFIXO_DE_SAIDA}${crypto.randomUUID()}`
}

export const simuladorAdapter: CanalAdapter = {
  slug: 'simulador',
  
  capabilities: {
    enviaMidia: false,
    markRead: false,
    conexaoPareada: false,
    precisaCredencial: false,
    
    
    
    janela24h: false,
    
    
    
    
    
    
    
    
    
    identidadePorTelefone: true,
    
    
    
    
    
    
    
    
    sintaxeWhatsapp: true,
    
    
    
    
    ecoaEnvioProprio: false,
    
    
    
    
    
    
    recebePorWebhook: false,
  },

  
  parse(): CanalEvent[] {
    return []
  },

  
  enviarTexto: async (): Promise<EnvioResultado> => ({
    ok: true,
    externalId: novoIdDeSaida(),
  }),
}
