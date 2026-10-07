














import 'server-only'
import { Agent } from '@mastra/core/agent'
import type { ToolsInput } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { createOpenAI } from '@ai-sdk/openai'
import { getSecret } from '@/server/secrets'
import {
  montarFerramentas,
  type CtxFerramentas,
  type DefinicaoFerramenta,
} from '@/server/agente/ferramentas'
import { CHAVE_MODELO, CHAVE_OPENAI, MODELO_PADRAO } from '@/server/agente/chaves'




export { CHAVE_MODELO, CHAVE_OPENAI, MODELO_PADRAO }

export async function lerChaveOpenAI(): Promise<string | null> {
  
  
  
  return (await getSecret(CHAVE_OPENAI))?.trim() || null
}

export async function lerModelo(): Promise<string> {
  return (await getSecret(CHAVE_MODELO))?.trim() || MODELO_PADRAO
}


const criarFerramenta = createTool as unknown as (d: DefinicaoFerramenta) => unknown

export function embrulharFerramentas(brutas: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(brutas).map(([nome, bruta]) => [nome, criarFerramenta(bruta as DefinicaoFerramenta)]),
  )
}


export function montarAgente(entrada: {
  apiKey: string
  modelo: string
  instrucoes: string
  ctx: CtxFerramentas
}): Agent {
  const openai = createOpenAI({ apiKey: entrada.apiKey })
  return new Agent({
    id: `atendimento-${entrada.ctx.conversaId}`,
    name: 'Atendimento',
    instructions: entrada.instrucoes,
    model: openai(entrada.modelo),
    tools: embrulharFerramentas(montarFerramentas(entrada.ctx)) as ToolsInput,
  })
}
