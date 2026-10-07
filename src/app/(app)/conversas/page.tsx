import { redirect } from 'next/navigation'
import { exigirSessao } from '@/server/auth/sessao'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { criarClienteServidor } from '@/server/supabase-session'
import { chaveParaONavegador, urlSupabase } from '@/server/config-supabase'
import { listarConversas } from '@/server/canais/leitura'
import { tituloDaPagina } from '@/server/marca'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import InboxClient from './InboxClient'
import estilos from './conversas.module.css'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Conversas') }
}




export const dynamic = 'force-dynamic'

export default async function ConversasPage() {
  await exigirSessao()
  const cliente = await criarClienteServidor()
  
  
  
  const ws = await resolverWorkspaceAtivo({ cliente })
  
  
  if (!ws) redirect('/sem-workspace')

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const conversas = await listarConversas(cliente, ws, { pagina: 0 })

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo="Conversas"
        subtitulo="As mensagens dos seus clientes, dentro do CRM."
      />
      {}
      <InboxClient
        conversasIniciais={conversas}
        supabaseUrl={urlSupabase()}
        anonKey={chaveParaONavegador(process.env.SUPABASE_ANON_KEY ?? '')}
        workspaceId={ws}
      />
    </div>
  )
}
