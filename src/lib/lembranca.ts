















export const PRAZO_DA_LEMBRANCA_MS = 15 * 60 * 1000

export type Lembranca<T> = {
  
  ler(agoraMs: number, fonte: () => Promise<T>): Promise<T>
  
  lembrar(valor: T, agoraMs: number): void
  
  esquecer(): void
}

export function criarLembranca<T>(prazoMs: number = PRAZO_DA_LEMBRANCA_MS): Lembranca<T> {
  let guardado: { valor: T; em: number } | null = null

  const vale = (agoraMs: number): boolean => {
    if (!guardado) return false
    const idade = agoraMs - guardado.em
    
    
    
    return idade >= 0 && idade < prazoMs
  }

  return {
    async ler(agoraMs, fonte) {
      if (guardado && vale(agoraMs)) return guardado.valor
      const valor = await fonte()
      guardado = { valor, em: agoraMs }
      return valor
    },
    lembrar(valor, agoraMs) {
      guardado = { valor, em: agoraMs }
    },
    esquecer() {
      guardado = null
    },
  }
}
