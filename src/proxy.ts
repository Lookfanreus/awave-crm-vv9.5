import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { urlSupabase } from '@/server/config-supabase'




const ROTAS_PUBLICAS = ['/entrar', '/cadastrar', '/convite']

function ehPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}


export function deveRedirecionar(pathname: string, temSessao: boolean): boolean {
  if (temSessao) return false
  if (pathname.startsWith('/api')) return false
  if (ehPublica(pathname)) return false
  return true
}


export function deveDiagnosticar(pathname: string, emDiagnostico: boolean): boolean {
  if (!emDiagnostico) return false
  if (pathname.startsWith('/api')) return false
  if (pathname === '/diagnostico') return false
  return true
}


export function ehIngressPublico(pathname: string): boolean {
  return /^\/api\/canais\/[^/]+\/webhook(\/|$)/.test(pathname)
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  
  
  
  
  if (process.env.AWAVE_MODO === 'diagnostico') {
    if (deveDiagnosticar(request.nextUrl.pathname, true)) {
      const destino = request.nextUrl.clone()
      destino.pathname = '/diagnostico'
      return NextResponse.rewrite(destino)
    }
    
    return NextResponse.next({ request })
  }

  
  
  if (ehIngressPublico(request.nextUrl.pathname)) return NextResponse.next({ request })

  let resposta = NextResponse.next({ request })

  
  
  
  
  const url = urlSupabase()
  const anon = (process.env.SUPABASE_ANON_KEY ?? '').trim()

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        resposta = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          resposta.cookies.set(name, value, options)
        }
        
        
        
        for (const [k, v] of Object.entries(headers ?? {})) resposta.headers.set(k, v)
      },
    },
  })

  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  
  
  
  if (deveRedirecionar(request.nextUrl.pathname, Boolean(user))) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/entrar'
    const redirecionamento = NextResponse.redirect(destino)
    
    for (const cookie of resposta.cookies.getAll()) redirecionamento.cookies.set(cookie)
    
    for (const [k, v] of resposta.headers) redirecionamento.headers.set(k, v)
    return redirecionamento
  }

  
  return resposta
}

export const config = {
  matcher: [
    
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
