import 'server-only'
import { cache } from 'react'
import { admin } from '@/server/supabase'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { resolverMembroAtivo } from '@/server/auth/membro-ativo'
import { nomeExibicao, rotuloSemNome } from '@/lib/nome-exibicao'



export type Pessoa = {
  
  id: string
  nome: string
  papel: 'owner' | 'membro'
}


async function carregar(): Promise<Pessoa[]> {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return []

  
  const { data, error } = await cliente
    .from('membros')
    .select('id, user_id, papel')
    .eq('workspace_id', ws)
    .order('criado_em', { ascending: true })
  if (error) throw error

  const linhas = (data as Array<{ id: string; user_id: string; papel: 'owner' | 'membro' }> | null) ?? []
  if (linhas.length === 0) return []

  const db = admin()
  return Promise.all(
    linhas.map(async (m) => {
      
      
      let meta: Record<string, unknown> | undefined
      let email: string | undefined
      try {
        const { data: u } = await db.auth.admin.getUserById(m.user_id)
        meta = u?.user?.user_metadata as Record<string, unknown> | undefined
        email = u?.user?.email ?? undefined
      } catch {
        meta = undefined
        email = undefined
      }
      return { id: m.id, nome: nomeExibicao(meta, email, rotuloSemNome(m.id)), papel: m.papel }
    }),
  )
}


export const listarPessoas = cache(carregar)


export const membroAtivo = cache(async (): Promise<string | null> => {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return null
  return resolverMembroAtivo({ cliente, ws })
})


export function nomeDaPessoa(pessoas: Pessoa[], id: string | null | undefined): string | null {
  if (!id) return null
  return pessoas.find((p) => p.id === id)?.nome ?? null
}
