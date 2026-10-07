import { bloqueioDeLicencaV1 } from '@/server/api/gate-licenca'
import { normalizarSlug, ehModuloAusente } from '@/lib/zona-custom'
import { mensagemSegura } from '@/lib/sanitizar-erro'



type Ctx = { params: Promise<{ slug: string[] }> }

function naoEncontrado(): Response {
  return Response.json(
    { error: { code: 'nao_encontrado', message: 'nao ha rota custom neste caminho' } },
    { status: 404 },
  )
}

async function despachar(req: Request, ctx: Ctx, verbo: string): Promise<Response> {
  const bloqueio = await bloqueioDeLicencaV1()
  if (bloqueio) return bloqueio

  const { slug } = await ctx.params
  
  const caminho = normalizarSlug(slug)
  if (!caminho) return naoEncontrado()

  let mod: Record<string, unknown>
  try {
    
    
    
    
    
    mod = await import(/* turbopackOptional: true */ `@custom/api/${caminho}.ts`)
  } catch (err) {
    
    
    if (ehModuloAusente(err)) return naoEncontrado()
    return erroDaCustomizacao(caminho, err)
  }

  const handler = mod[verbo]
  if (typeof handler !== 'function') {
    return Response.json(
      { error: { code: 'metodo_nao_suportado', message: `este endereco nao aceita ${verbo}` } },
      { status: 405 },
    )
  }

  try {
    return await (handler as (r: Request) => Promise<Response>)(req)
  } catch (err) {
    return erroDaCustomizacao(caminho, err)
  }
}


function erroDaCustomizacao(caminho: string, err: unknown): Response {
  const detalhe = mensagemSegura(err)
  
  
  
  
  
  
  
  console.error('[custom/api] falhou:', caminho, detalhe)
  return Response.json(
    {
      error: {
        code: 'erro_na_customizacao',
        message: 'erro no codigo custom deste servidor; o detalhe esta no log do container',
      },
    },
    { status: 500 },
  )
}

export const GET = (req: Request, ctx: Ctx) => despachar(req, ctx, 'GET')
export const POST = (req: Request, ctx: Ctx) => despachar(req, ctx, 'POST')
export const PUT = (req: Request, ctx: Ctx) => despachar(req, ctx, 'PUT')
export const PATCH = (req: Request, ctx: Ctx) => despachar(req, ctx, 'PATCH')
export const DELETE = (req: Request, ctx: Ctx) => despachar(req, ctx, 'DELETE')
