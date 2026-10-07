import { headers } from 'next/headers'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import PlugarIA, { type CredencialItem, type WebhookConfig } from '../PlugarIA'
import estilos from '../config.module.css'
import VoltarConfig from '../VoltarConfig'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Integração por API') }
}


export default async function ConfigIaPage() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente }) 

  const { data } = await cliente
    .from('credenciais_api')
    .select('key_id, rotulo, criado_em')
    .eq('workspace_id', ws as string)
    .is('revogado_em', null)
    .order('criado_em', { ascending: false })

  const { data: wcfg } = await cliente
    .from('webhook_config')
    .select('endpoint_url, ativo')
    .eq('workspace_id', ws as string)
    .maybeSingle()

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const urlBase = `${proto}://${host}`

  return (
    <div className={estilos.pagina}>
      {}
      <CabecalhoPagina
        acima={<VoltarConfig />}
        titulo="Integração por API"
        subtitulo="Gere uma credencial para outro sistema agir neste espaço de trabalho — inclusive a IA da Awave — e aponte o webhook que o avisa quando algo acontece. Não é aqui que se liga o assistente do WhatsApp: ele fica em Agentes de IA."
      />
      <PlugarIA
        urlBase={urlBase}
        credenciais={(data ?? []) as CredencialItem[]}
        webhook={(wcfg as WebhookConfig | null) ?? null}
      />
    </div>
  )
}
