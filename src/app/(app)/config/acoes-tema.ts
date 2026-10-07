'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/server/supabase-session'
import { COOKIE_TEMA, normalizarTema } from '@/lib/tema'




export async function salvarTema(valor: string): Promise<{ ok: true } | { erro: 'tema_invalido' }> {
  const tema = normalizarTema(valor)
  if (!tema) return { erro: 'tema_invalido' }

  
  
  
  const jar = await cookies()
  jar.set(COOKIE_TEMA, tema, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  
  
  try {
    const supabase = await criarClienteServidor()
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      
      
      
      await supabase.auth.updateUser({ data: { ...data.user.user_metadata, tema } })
    }
  } catch {
    
    
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
