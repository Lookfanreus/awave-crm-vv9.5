import 'server-only'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { urlSupabase } from '@/server/config-supabase'




function credenciais(): { url: string; anon: string } {
  return { url: urlSupabase(), anon: (process.env.SUPABASE_ANON_KEY ?? '').trim() }
}


export async function criarClienteServidor(): Promise<SupabaseClient> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const { url, anon } = credenciais()
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, headers) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
          
          
          
          
          
          void headers
        } catch {
          
        }
      },
    },
  })
}
