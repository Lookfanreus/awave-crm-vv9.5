import Link from 'next/link'
import {
  Filter, SlidersHorizontal, Upload, Zap, ListChecks, Plug, ChevronRight, MessageSquare, Bot,
} from 'lucide-react'
import { versaoParaExibir, licenciadoPara } from '@/server/versao'
import { lerLicenca } from './acoes-licenca'
import LicencaCard from './LicencaCard'
import { lerAtualizacao } from './acoes-atualizacao'
import AtualizacoesCard from './AtualizacoesCard'
import { lerEquipe } from './acoes-equipe'
import EquipeCard from './EquipeCard'
import { lerMarcaConfig } from './acoes-marca'
import MarcaCard from './MarcaCard'
import estilos from './config.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina, lerMarca } from '@/server/marca'
import AbasConfig from './AbasConfig'
import { abasDisponiveis, resolverAba } from '@/lib/config-abas'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Configurações') }
}


function Destino({ href, icone, titulo, sub }: {
  href: string; icone: React.ReactNode; titulo: string; sub: string
}) {
  return (
    <Link href={href} className={estilos.destino}>
      <span className={estilos.destinoIcone}>{icone}</span>
      <span className={estilos.destinoTexto}>
        <span className={estilos.destinoNome}>{titulo}</span>
        <span className={estilos.destinoSub}>{sub}</span>
      </span>
      <ChevronRight size={16} strokeWidth={1.75} className={estilos.destinoSeta} />
    </Link>
  )
}


export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  
  
  
  
  const rEquipe = await lerEquipe()
  const equipe = 'erro' in rEquipe ? null : rEquipe

  
  
  
  
  const souDonoDoDeploy = await ehDonoDoDeploy()

  const abas = abasDisponiveis({ pessoas: equipe != null, servidor: souDonoDoDeploy })
  const aba = resolverAba((await searchParams).aba, abas)

  
  
  
  
  const mostrarServidor = aba === 'servidor'
  const rLicenca = mostrarServidor ? await lerLicenca() : null
  const licenca = rLicenca && !('erro' in rLicenca) ? rLicenca : null
  const rAtualizacao = mostrarServidor ? await lerAtualizacao() : null
  const atualizacao = rAtualizacao && !('erro' in rAtualizacao) ? rAtualizacao : null
  const rMarca = mostrarServidor ? await lerMarcaConfig() : null
  const marca = rMarca && !('erro' in rMarca) ? rMarca : null

  
  
  const { nome: marcaNome } = await lerMarca()

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo="Configurações"
        
        
        
        
        subtitulo="Ajuste o CRM ao seu processo. Cada seção diz a quem ela vale."
      />

      <AbasConfig abas={abas} ativa={aba} />

      {}
      {aba === 'espaco' && (
        <>
          <section className={estilos.bloco}>
            <div className={estilos.blocoCab}>
              <h2 className={estilos.blocoTitulo}>Seu processo de vendas</h2>
              <span className={estilos.blocoMeta}>Vale para este espaço de trabalho</span>
            </div>
            <div className={estilos.destinos}>
              <Destino href="/config/funis" icone={<Filter size={16} strokeWidth={1.75} />}
                titulo="Funis" sub="Crie e edite seus funis de venda e etapas." />
              <Destino href="/config/campos" icone={<SlidersHorizontal size={16} strokeWidth={1.75} />}
                titulo="Campos" sub="Crie campos próprios e defina o que é obrigatório em cada etapa." />
              {}
              <Destino href="/config/tipos-atividade" icone={<ListChecks size={16} strokeWidth={1.75} />}
                titulo="Tipos de atividade" sub="Personalize o que aparece ao registrar uma atividade." />
            </div>
          </section>

          <section className={estilos.bloco}>
            <div className={estilos.blocoCab}>
              <h2 className={estilos.blocoTitulo}>Dados e integrações</h2>
              <span className={estilos.blocoMeta}>Vale para este espaço de trabalho</span>
            </div>
            <div className={estilos.destinos}>
              <Destino href="/config/importar" icone={<Upload size={16} strokeWidth={1.75} />}
                titulo="Importar planilha" sub="Traga contatos, empresas ou negócios de um arquivo CSV." />
              {}
              <Destino href="/config/ia" icone={<Plug size={16} strokeWidth={1.75} />}
                titulo="Integração por API" sub="Gere a credencial e o webhook para outro sistema agir neste CRM — inclusive a IA da Awave. Não é aqui que se liga o assistente que responde no WhatsApp: esse é o cartão Agentes de IA." />
              {}
              <Destino href="/config/canais" icone={<MessageSquare size={16} strokeWidth={1.75} />}
                titulo="Canais" sub="Conecte o WhatsApp e o Instagram da sua empresa e receba as mensagens aqui. O servidor de mensagens vale para o servidor inteiro." />
              {}
              <Destino href="/agentes" icone={<Bot size={16} strokeWidth={1.75} />}
                titulo="Agentes de IA" sub="Assistentes automáticos que respondem no WhatsApp enquanto sua equipe não pode. Cada um nasce desligado, e a chave que eles usam vale para o servidor inteiro." />
            </div>
          </section>
        </>
      )}

      {}
      {aba === 'pessoas' && equipe ? <EquipeCard inicial={equipe} /> : null}

      {aba === 'servidor' && (
        <>
          {}
          {}
          {marca ? <MarcaCard inicial={marca} /> : null}

          {licenca ? <LicencaCard inicial={licenca} /> : null}
          {atualizacao ? <AtualizacoesCard inicial={atualizacao} /> : null}
        </>
      )}

      {}
      <p className={estilos.versao}>
        {marcaNome} <strong>{versaoParaExibir()}</strong>
        {licenciadoPara() ? <> · licenciado para {licenciadoPara()}</> : null}
      </p>
    </div>
  )
}
