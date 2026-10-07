import 'server-only'
import { admin } from '@/server/supabase'
import { mostrarLinkDeCadastro } from '@/lib/cadastro-aberto'


export async function ehInstalacaoNova(): Promise<boolean> {
  try {
    const db = admin()
    const { data } = await db.from('settings').select('value').eq('key', 'bootstrap_feito').maybeSingle()
    if ((data as { value?: string } | null)?.value !== 'false') return false

    
    const { count } = await db.from('membros').select('*', { count: 'exact', head: true })
    return (count ?? 0) === 0
  } catch {
    return false 
  }
}


export async function podeCadastrarSemConvite(): Promise<boolean> {
  try {
    const db = admin()
    const { data, error } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['bootstrap_feito', 'signup_aberto'])
    if (error) return true
    const linhas = (data ?? []) as { key?: string; value?: string | null }[]
    const ler = (k: string) => linhas.find((l) => l.key === k)?.value ?? null
    return mostrarLinkDeCadastro({
      bootstrapFeito: ler('bootstrap_feito'),
      signupAberto: ler('signup_aberto'),
    })
  } catch {
    return true 
  }
}
