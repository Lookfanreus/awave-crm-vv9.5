

export const CHAVE_DONO_DEPLOY = 'dono_deploy_user_id'

export function decidirDonoDoDeploy(e: {
  
  registrado: string | null
  
  donoDoWorkspaceMaisAntigo: string | null
}): string | null {
  const registrado = e.registrado?.trim()
  if (registrado) return registrado
  return e.donoDoWorkspaceMaisAntigo?.trim() || null
}


export function ehODono(
  userId: string | null | undefined,
  dono: string | null,
): boolean {
  if (!userId || !dono) return false
  return userId === dono
}
