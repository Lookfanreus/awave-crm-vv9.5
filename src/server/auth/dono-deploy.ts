import 'server-only'
import { admin } from '@/server/supabase'
import { criarClienteServidor } from '@/server/supabase-session'
import { CHAVE_DONO_DEPLOY, decidirDonoDoDeploy, ehODono } from '@/lib/dono-deploy'




export async function reivindicarDonoDoDeploy(userId: string): Promise<void> {
  
  
  
  
  try {
    await admin().from('settings').insert({ key: CHAVE_DONO_DEPLOY, value: userId })
  } catch {
    
    
  }
}


export async function donoDoDeploy(): Promise<string | null> {
  const db = admin()
  const [reg, ws] = await Promise.all([
    db.from('settings').select('value').eq('key', CHAVE_DONO_DEPLOY).maybeSingle(),
    db
      .from('workspaces')
      .select('dono_id')
      .order('criado_em', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])
  return decidirDonoDoDeploy({
    registrado: (reg.data?.value as string | null) ?? null,
    donoDoWorkspaceMaisAntigo: (ws.data?.dono_id as string | null) ?? null,
  })
}


export async function ehDonoDoDeploy(): Promise<boolean> {
  const sessao = await criarClienteServidor()
  const {
    data: { user },
  } = await sessao.auth.getUser()
  if (!user) return false
  return ehODono(user.id, await donoDoDeploy())
}
