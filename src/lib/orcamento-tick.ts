
















export const ABORTO_TICK_MS = 60_000


export const LIMITE_DO_TICK_MS = 45_000


export const FOLGA_NAO_REDE_AGENTE_MS = 6_000


export const PIORES_CASOS = {
  
  automacao: 5_000,
  
  entrega: 8_000,
  
  licenca: 5_000,
  
  fila: 20_000,
  
  agente: 50_000,
  
  midia: 30_000,
  
  perfis: 20_000,
  
  custom: 10_000,
  
  expurgo: 5_000,
} as const

export type NomeDeBraco = keyof typeof PIORES_CASOS


export const PORTOES: Record<NomeDeBraco, number> = {
  automacao: PIORES_CASOS.automacao,
  entrega: PIORES_CASOS.entrega,
  licenca: PIORES_CASOS.licenca,
  fila: PIORES_CASOS.fila,
  agente: 35_000,
  midia: PIORES_CASOS.midia,
  perfis: PIORES_CASOS.perfis,
  custom: PIORES_CASOS.custom,
  expurgo: PIORES_CASOS.expurgo,
}

export interface Orcamento {
  
  readonly comecoMs: number
  
  restaMs(): number
  venceu(): boolean
  
  cabe(nome: NomeDeBraco): boolean
  
  fatiaPara(nome: NomeDeBraco, tetoMs?: number): number
}

export function criarOrcamento(comecoMs: number, agoraMs: () => number = Date.now): Orcamento {
  const fim = comecoMs + LIMITE_DO_TICK_MS
  
  
  
  
  const resta = () => {
    const agora = agoraMs()
    if (!Number.isFinite(agora) || !Number.isFinite(comecoMs)) return LIMITE_DO_TICK_MS
    return Math.max(0, Math.min(LIMITE_DO_TICK_MS, fim - agora))
  }
  return {
    comecoMs,
    restaMs: resta,
    venceu: () => resta() <= 0,
    cabe: (nome) => resta() >= PORTOES[nome],
    fatiaPara: (nome, tetoMs) => Math.max(0, Math.min(tetoMs ?? PIORES_CASOS[nome], resta())),
  }
}
