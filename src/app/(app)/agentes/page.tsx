import { lerPainelDoAgente } from '@/server/agente/painel'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { abasDisponiveis, hrefDaAba, resolverAba, ROTULO_ABA } from '@/lib/agentes-abas'
import BarraDeAbas from '@/components/ui/BarraDeAbas'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'
import ListaDeAgentes from './ListaDeAgentes'
import Atendimento from './Atendimento'
import Servidor from './Servidor'
import estilos from './agentes.module.css'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Agentes de IA') }
}


export default async function AgentesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string | string[] }>
}) {
  
  
  
  
  
  let painel: Awaited<ReturnType<typeof lerPainelDoAgente>>
  try {
    painel = await lerPainelDoAgente()
  } catch {
    return (
      <div className={estilos.pagina}>
        <CabecalhoPagina titulo="Agentes de IA" subtitulo={SUBTITULO} />
        <section className={estilos.bloco}>
          <div className={estilos.blocoCab}>
            <h2 className={estilos.blocoTitulo}>Não consegui ler os agentes agora</h2>
          </div>
          {}
          <p className={estilos.frase}>
            Nada foi perdido: o que você escreveu continua salvo. Recarregue a página em alguns
            instantes. Se continuar assim, fale com quem instalou o CRM.
          </p>
        </section>
      </div>
    )
  }

  
  
  const abas = abasDisponiveis({ servidor: await ehDonoDoDeploy() })
  const aba = resolverAba((await searchParams).aba, abas)

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo="Agentes de IA" subtitulo={SUBTITULO} />
      <BarraDeAbas
        abas={abas}
        ativa={aba}
        rotulo="Seções dos agentes de IA"
        href={hrefDaAba}
        rotuloDaAba={(a) => ROTULO_ABA[a]}
        classes={{ barra: estilos.abas, aba: estilos.aba, ativa: estilos.abaAtiva }}
      />
      {aba === 'agentes' ? <ListaDeAgentes inicial={painel} /> : null}
      {aba === 'atendimento' ? <Atendimento inicial={painel} /> : null}
      {aba === 'servidor' ? <Servidor inicial={painel} /> : null}
    </div>
  )
}


const SUBTITULO =
  'Quem responde as mensagens do WhatsApp quando sua equipe não pode. Cada agente atende os ' +
  'números que você escolher, e nenhum responde antes de ser ligado.'
