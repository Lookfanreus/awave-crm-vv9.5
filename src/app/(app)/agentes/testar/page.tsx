import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { ehOwnerDoWorkspace } from '@/server/auth/owner-workspace'
import { getSecret } from '@/server/secrets'


import { CHAVE_OPENAI } from '@/server/agente/chaves'
import { conversaDaSessaoDeSimulacao, lerCanalDeSimulacao } from '@/server/simulador/canal'



import { lerAssistentesDoWorkspace } from '@/server/agente/painel'
import { lerThread, type MensagemThread } from '@/server/canais/leitura'
import Simulador from './Simulador'
import estilos from '../agentes.module.css'
import VoltarAgentes from '../VoltarAgentes'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Testar o assistente') }
}


export default async function SimuladorPage() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  const temChave = Boolean((await getSecret(CHAVE_OPENAI))?.trim())

  const canal = ws ? await lerCanalDeSimulacao(ws) : null
  
  
  const ehOwner = ws ? await ehOwnerDoWorkspace(ws) : false

  
  
  let fio: MensagemThread[] = []
  if (ws && canal) {
    const conversaId = await conversaDaSessaoDeSimulacao(ws, canal)
    if (conversaId) fio = await lerThread(cliente, ws, conversaId)
  }

  
  
  
  
  
  const assistentes = ws
    ? (await lerAssistentesDoWorkspace(ws)).map((a) => ({
        id: a.id,
        nomeInterno: a.nomeInterno,
        padrao: a.padrao,
      }))
    : []

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        acima={<VoltarAgentes />}
        titulo="Testar o assistente"
        subtitulo="Escreva como se fosse um cliente e veja o que o assistente responde. Nada sai daqui: nenhuma mensagem é enviada para ninguém."
      />
      <Simulador
        fio={fio.map((m) => ({ id: m.id, autor: m.autor, texto: m.texto }))}
        temChave={temChave}
        ehOwner={ehOwner}
        canalLigado={canal?.agente_ligado ?? true}
        assistentes={assistentes}
      />
    </div>
  )
}
