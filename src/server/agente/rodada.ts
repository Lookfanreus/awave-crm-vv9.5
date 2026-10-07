









import 'server-only'

export interface HeadlessAgenteLike {
  
  stream(mensagens: unknown, opcoes?: { maxSteps?: number }): Promise<{ fullStream: unknown }>
}

export type FalaDoTurno = { role: 'user' | 'assistant'; content: string }


export type FimAnormal = 'prazo' | 'sem_stream'

export interface RodadaResultado {
  texto: string
  concluiu: boolean
  tokensEntrada: number
  tokensSaida: number
  
  usoConhecido: boolean
  fimAnormal?: FimAnormal
  
  erro?: { mensagem: string; codigoHttp: number | null }
}

export interface PrazosDaRodada {
  
  passosMax: number
  
  silencioMs: number
  
  silencioToolMs: number
  
  turnoMaxMs: number
}


export function cortadoPeloPrazo(r: RodadaResultado): boolean {
  return r.fimAnormal === 'prazo' && !r.concluiu
}

const EXPIROU = Symbol('prazo vencido')


async function correrContraORelogio<T>(p: Promise<T>, ms: number): Promise<T | typeof EXPIROU> {
  if (ms <= 0) return EXPIROU
  let id: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      p,
      new Promise<typeof EXPIROU>((resolve) => {
        id = setTimeout(() => resolve(EXPIROU), ms)
      }),
    ])
  } finally {
    if (id !== undefined) clearTimeout(id)
  }
}

type LeitorDeChunks = {
  read(): Promise<{ done: boolean; value?: unknown }>
  releaseLock?: () => void
}


function leitorDe(fullStream: unknown): LeitorDeChunks | null {
  const s = fullStream as { getReader?: () => LeitorDeChunks } | null | undefined
  return typeof s?.getReader === 'function' ? s.getReader() : null
}

function cancelar(fullStream: unknown): void {
  const s = fullStream as { cancel?: () => Promise<unknown> } | null | undefined
  if (typeof s?.cancel === 'function') {
    
    
    void s.cancel().catch(() => {})
  }
}

function tipoDe(chunk: unknown): string | undefined {
  return (chunk as { type?: unknown } | null | undefined)?.type as string | undefined
}


function detalharErro(err: unknown): { mensagem: string; codigoHttp: number | null } {
  const e = err as { message?: unknown; statusCode?: unknown; status?: unknown } | null | undefined
  const bruto = e?.statusCode ?? e?.status
  const codigoHttp = typeof bruto === 'number' && Number.isFinite(bruto) ? bruto : null
  const mensagem = typeof e?.message === 'string' ? e.message : String(err)
  return { mensagem, codigoHttp }
}

export async function rodarUmaRodada(
  agente: HeadlessAgenteLike,
  mensagens: FalaDoTurno[],
  prazos: PrazosDaRodada,
  agoraMs: () => number = Date.now,
): Promise<RodadaResultado> {
  let texto = ''
  let concluiu = false
  let tokensEntrada = 0
  let tokensSaida = 0
  let usoConhecido = false
  let ferramentasEmVoo = 0
  let fimAnormal: FimAnormal | undefined
  let erro: { mensagem: string; codigoHttp: number | null } | undefined

  const inicio = agoraMs()
  const resultado = (): RodadaResultado => ({
    texto,
    concluiu,
    tokensEntrada,
    tokensSaida,
    usoConhecido,
    ...(fimAnormal ? { fimAnormal } : {}),
    ...(erro ? { erro } : {}),
  })

  
  const orcamento = (): number => {
    const silencio = ferramentasEmVoo > 0 ? prazos.silencioToolMs : prazos.silencioMs
    return Math.min(silencio, prazos.turnoMaxMs - (agoraMs() - inicio))
  }

  
  
  
  
  if (orcamento() <= 0) {
    fimAnormal = 'prazo'
    return resultado()
  }

  let criacao: Promise<{ fullStream: unknown }>
  try {
    criacao = agente.stream(mensagens, { maxSteps: prazos.passosMax })
  } catch (err) {
    fimAnormal = 'sem_stream'
    erro = detalharErro(err)
    return resultado()
  }

  const criado = await correrContraORelogio(
    criacao.then(
      (r) => ({ ok: true as const, r }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
    orcamento(),
  )
  if (criado === EXPIROU) {
    fimAnormal = 'prazo'
    
    
    
    void criacao.then((r) => cancelar(r.fullStream)).catch(() => {})
    return resultado()
  }
  if (!criado.ok) {
    fimAnormal = 'sem_stream'
    erro = detalharErro(criado.err)
    return resultado()
  }

  const leitor = leitorDe(criado.r.fullStream)
  if (!leitor) {
    fimAnormal = 'sem_stream'
    erro = { mensagem: 'o assistente nao devolveu um fluxo legivel', codigoHttp: null }
    return resultado()
  }

  try {
    for (;;) {
      const ms = orcamento()
      if (ms <= 0) {
        fimAnormal = 'prazo'
        break
      }
      const lido = await correrContraORelogio(leitor.read(), ms)
      if (lido === EXPIROU) {
        fimAnormal = 'prazo'
        break
      }
      if (lido.done) break

      const chunk = lido.value
      const tipo = tipoDe(chunk)
      if (tipo === 'text-delta') {
        texto += (chunk as { payload?: { text?: string } }).payload?.text ?? ''
      } else if (tipo === 'tool-call') {
        ferramentasEmVoo++
      } else if (tipo === 'tool-result' || tipo === 'tool-error') {
        ferramentasEmVoo = Math.max(0, ferramentasEmVoo - 1)
      } else if (tipo === 'step-finish') {
        
        
        const uso = (
          chunk as { payload?: { output?: { usage?: { inputTokens?: number; outputTokens?: number } } } }
        ).payload?.output?.usage
        
        
        
        if (uso) usoConhecido = true
        tokensEntrada += uso?.inputTokens ?? 0
        tokensSaida += uso?.outputTokens ?? 0
      } else if (tipo === 'finish') {
        concluiu = true
      }
      
    }
  } catch (err) {
    
    
    
    erro = detalharErro(err)
  } finally {
    leitor.releaseLock?.()
    if (fimAnormal === 'prazo') cancelar(criado.r.fullStream)
  }

  return resultado()
}
