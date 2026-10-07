import 'server-only'
import { motivoDeBloqueioAtual } from '@/server/license/bloqueio'


export async function exigirEngineLiberado(): Promise<void> {
  
  
  if (!(await motivoDeBloqueioAtual())) return

  const { redirect } = await import('next/navigation')
  redirect('/licenca') 
  throw new Error('redirect não interrompeu o fluxo')
}
