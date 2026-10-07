import 'server-only'
import { admin } from '@/server/supabase'
import { reivindicarDonoDoDeploy } from '@/server/auth/dono-deploy'
import { conviteEhValido } from '@/server/auth/convites'
import { tokenBootstrap } from '../../../config-deploy.mjs'




type Resultado = { ok: true; workspaceId: string | null } | { erro: string }

export async function registrar({ email, senha, nomeWorkspace, tokenInformado, convite }: {
  email: string
  senha: string
  nomeWorkspace: string
  tokenInformado?: string
  
  convite?: string
}): Promise<Resultado> {
  const db = admin()

  
  
  
  
  
  
  
  const comConvite = convite ? await conviteEhValido(convite) : false
  if (convite && !comConvite) return { erro: 'convite_invalido' }

  
  
  
  
  
  
  
  let ehBootstrap = false
  if (!comConvite) {
    const { data: claim, error: eClaim } = await db
      .from('settings')
      .update({ value: 'true' })
      .eq('key', 'bootstrap_feito')
      .eq('value', 'false')
      .select('key')
    if (eClaim) return { erro: 'falha_bootstrap' } 
    ehBootstrap = (claim?.length ?? 0) > 0
  }

  
  
  
  
  
  
  
  
  
  
  if (ehBootstrap) {
    const esperado = tokenBootstrap((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
    if (esperado && tokenInformado?.trim().toUpperCase() !== esperado) {
      await db.from('settings').update({ value: 'false' }).eq('key', 'bootstrap_feito')
      return { erro: 'token_bootstrap_invalido' }
    }
  }

  if (!ehBootstrap && !comConvite) {
    const { data: s } = await db
      .from('settings')
      .select('value')
      .eq('key', 'signup_aberto')
      .maybeSingle()
    if ((s as { value?: string } | null)?.value !== 'true') return { erro: 'cadastro_fechado' }
  }

  
  const { data: u, error } = await db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error || !u?.user) {
    
    if (ehBootstrap) await db.from('settings').update({ value: 'false' }).eq('key', 'bootstrap_feito')
    return { erro: 'falha_criar_usuario' }
  }

  
  
  
  
  
  
  if (comConvite) return { ok: true, workspaceId: null }

  const { data: wsId, error: e2 } = await db.rpc('criar_workspace', {
    nome: nomeWorkspace,
    p_dono: u.user.id,
  })
  if (e2 || !wsId) {
    
    
    
    
    
    
    if (ehBootstrap) {
      await db.auth.admin.deleteUser(u.user.id).catch(() => {})
      await db.from('settings').update({ value: 'false' }).eq('key', 'bootstrap_feito')
    }
    return { erro: 'falha_criar_workspace' }
  }

  
  
  
  
  
  
  
  
  if (ehBootstrap) await reivindicarDonoDoDeploy(u.user.id)

  return { ok: true, workspaceId: wsId as string }
}
