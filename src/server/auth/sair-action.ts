'use server'

import { sair } from '@/server/auth/sessao'


export async function sairAction(): Promise<void> {
  await sair()
}
