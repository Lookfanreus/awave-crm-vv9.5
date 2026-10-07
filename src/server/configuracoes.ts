import 'server-only'
import { admin } from './supabase'



export async function lerConfig(chave: string): Promise<string | null> {
  const { data } = await admin()
    .from('settings')
    .select('value')
    .eq('key', chave)
    .maybeSingle()
  return (data?.value as string | null) ?? null
}

export async function gravarConfig(chave: string, valor: string): Promise<void> {
  await admin()
    .from('settings')
    .upsert({ key: chave, value: valor }, { onConflict: 'key' })
}
