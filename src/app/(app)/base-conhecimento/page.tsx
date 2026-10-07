import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { ehOwnerDoWorkspace } from '@/server/auth/owner-workspace'


import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { getSecret } from '@/server/secrets'


import { CHAVE_OPENAI } from '@/server/agente/chaves'
import { lerAssistentesDoWorkspace } from '@/server/agente/painel'
import { contarSemVetor, listarBase } from '@/server/crm/base-conhecimento'
import BaseDeConhecimento from './BaseDeConhecimento'
import estilos from '../config/config.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('O que o assistente sabe') }
}


const SUBTITULO =
  'Os fatos do seu negócio — preço, prazo, política. É daqui que o assistente tira essas respostas; o que não estiver escrito, ele diz que não sabe.'


export default async function BaseDeConhecimentoPage() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  const temChave = Boolean((await getSecret(CHAVE_OPENAI))?.trim())

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  let entradas: Awaited<ReturnType<typeof listarBase>> = []
  let semVetor = 0
  if (ws) {
    try {
      entradas = await listarBase(ws)
      semVetor = await contarSemVetor(ws)
    } catch {
      return (
        <div className={estilos.pagina}>
          <CabecalhoPagina
                titulo="O que o assistente sabe"
            subtitulo={SUBTITULO}
          />
          <section className={estilos.bloco}>
            <div className={estilos.blocoCab}>
              <h2 className={estilos.blocoTitulo}>Não consegui ler o que já está escrito</h2>
            </div>
            {}
            <p className={estilos.frase}>
              Nada foi apagado: o que você escreveu continua guardado. A lista fica escondida
              para você não escrever por cima do que já existe. Recarregue a página em alguns
              instantes; se continuar assim, fale com quem instalou o CRM.
            </p>
          </section>
        </div>
      )
    }
  }
  
  
  const ehOwner = ws ? await ehOwnerDoWorkspace(ws) : false
  const ehDono = await ehDonoDoDeploy()

  
  
  
  
  
  let assistentesBrutos: Awaited<ReturnType<typeof lerAssistentesDoWorkspace>> = []
  if (ws) {
    try {
      assistentesBrutos = await lerAssistentesDoWorkspace(ws)
    } catch {
      assistentesBrutos = []
    }
  }
  
  
  
  
  const assistentes = assistentesBrutos.map((a) => ({ id: a.id, nomeInterno: a.nomeInterno }))

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo="O que o assistente sabe"
        subtitulo={SUBTITULO}
      />
      <BaseDeConhecimento
        entradas={entradas}
        semVetor={semVetor}
        temChave={temChave}
        ehDono={ehDono}
        ehOwner={ehOwner}
        assistentes={assistentes}
      />
    </div>
  )
}
