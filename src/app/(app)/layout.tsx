import { redirect } from 'next/navigation'
import { exigirSessao } from '@/server/auth/sessao'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { motivoDeBloqueioAtual } from '@/server/license/bloqueio'
import { mostrarAvisoDeAtualizacao } from '@/server/atualizacao/aviso'
import { criarClienteServidor } from '@/server/supabase-session'
import { nomeExibicao } from '@/lib/nome-exibicao'
import Rail from '@/components/shell/Rail'
import { NavMobileProvider, GavetaRail, BarraMobile } from '@/components/shell/NavMobile'
import type { WorkspaceOpcao } from '@/components/shell/SeletorWorkspace'
import DrawerProvider from './_crm/DrawerProvider'
import estilos from './app-shell.module.css'


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await exigirSessao()

  
  
  
  
  
  
  if (await motivoDeBloqueioAtual()) redirect('/licenca')

  const wsAtivo = await resolverWorkspaceAtivo()
  if (wsAtivo === null) redirect('/sem-workspace')

  const cliente = await criarClienteServidor()
  const { data, error } = await cliente
    .from('membros')
    .select('workspace_id, criado_em, workspaces(id, nome)')
    .eq('user_id', user.id) 
    .order('criado_em', { ascending: true })
  if (error) throw error

  
  
  const workspaces: WorkspaceOpcao[] = ((data ?? []) as LinhaMembro[])
    .map((m) => (Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces) ?? null)
    .filter((w): w is WorkspaceOpcao => w !== null && typeof w.id === 'string')
    .map((w) => ({ id: w.id, nome: w.nome }))

  const nome = nomeExibicao(user.user_metadata, user.email)

  
  
  
  
  const avisoAtualizacao = await mostrarAvisoDeAtualizacao(user.id)

  return (
    
    
    
    
    
    
    <NavMobileProvider>
      <div className={estilos.shell}>
        <GavetaRail>
          <Rail
            user={{ nome, email: user.email ?? '' }}
            wsAtivo={wsAtivo}
            workspaces={workspaces}
            avisoAtualizacao={avisoAtualizacao}
          />
        </GavetaRail>
        <div className={estilos.coluna}>
          <BarraMobile />
          <main className={estilos.conteudo}>
            <DrawerProvider>{children}</DrawerProvider>
          </main>
        </div>
      </div>
    </NavMobileProvider>
  )
}

type WsEmbed = { id: string; nome: string }
type LinhaMembro = {
  workspace_id: string
  criado_em: string
  
  workspaces: WsEmbed | WsEmbed[] | null
}


