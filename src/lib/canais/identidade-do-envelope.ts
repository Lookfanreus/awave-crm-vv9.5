























































































export type MotivoDaRecusa = 'canal_nao_pareado' | 'instancia_diferente' | 'token_diferente'

export type IdentidadeDoEnvelope = { ok: true } | { ok: false; motivo: MotivoDaRecusa }


export function nomeDaInstancia(envelope: unknown): string | null {
  if (!envelope || typeof envelope !== 'object') return null
  const env = envelope as { instance?: unknown; instanceName?: unknown }
  const aninhado =
    env.instance && typeof env.instance === 'object'
      ? (env.instance as { name?: unknown }).name
      : undefined
  if (typeof aninhado === 'string' && aninhado !== '') return aninhado
  if (typeof env.instanceName === 'string' && env.instanceName !== '') return env.instanceName
  return null
}


export function tokenDeclarado(envelope: unknown): string | null {
  if (!envelope || typeof envelope !== 'object') return null
  const env = envelope as { token?: unknown }
  if (env.token === undefined) return null
  return typeof env.token === 'string' ? env.token : ''
}


export function conferirIdentidade(
  e: {
    
    tokenDeclarado: string | null
    nomeDaInstancia: string | null
    
    tokenDoCanal: string
    externalId: string | null
  },
  comparar: (a: string, b: string) => boolean,
): IdentidadeDoEnvelope {
  if (!e.externalId) return { ok: false, motivo: 'canal_nao_pareado' }
  if (e.nomeDaInstancia === null || e.nomeDaInstancia !== e.externalId) {
    return { ok: false, motivo: 'instancia_diferente' }
  }
  
  if (e.tokenDeclarado !== null && !comparar(e.tokenDeclarado, e.tokenDoCanal)) {
    return { ok: false, motivo: 'token_diferente' }
  }
  return { ok: true }
}
