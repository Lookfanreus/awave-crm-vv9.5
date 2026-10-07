import type { CSSProperties } from 'react'
import { exigirSessao } from '@/server/auth/sessao'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { criarClienteServidor } from '@/server/supabase-session'
import {
  kpis,
  negociosPorEtapa,
  negociosParados,
  negociosPrevistos,
  seriesKpi,
  semOsParados,
  type PeriodoDias,
} from '@/server/crm/metricas'
import { resolverMembroAtivo } from '@/server/auth/membro-ativo'
import { listarAgenda } from '@/server/crm/agenda-consulta'
import { classificarVencimento } from '@/server/crm/agenda'
import KpiCard from '@/components/ui/KpiCard'
import ChartCard from '@/components/ui/ChartCard'
import ListCard, { type LinhaLista } from '@/components/ui/ListCard'
import Avatar from '@/components/ui/Avatar'
import Pill from '@/components/ui/Pill'
import GraficoEtapas from './GraficoEtapas'
import MinhaAgenda from './MinhaAgenda'
import SeletorPeriodo from './SeletorPeriodo'
import { moedaBRL } from '@/lib/formato'
import { variantePrevisao, rotuloPrevisao, frasePrevisao, fraseParado } from '@/lib/previsao'
import mov from '@/app/movimento.module.css'
import Slot from '@/components/custom/Slot'
import estilos from './painel.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Painel') }
}


const DIAS_PARADO = 14


const DIAS_PREVISAO = 7


const LINHAS_LISTA = 5


const BUSCA_PREVISTOS = LINHAS_LISTA * 2


export function periodoDeParam(v: string | undefined): PeriodoDias {
  const n = Number(v)
  return n === 7 || n === 90 ? n : 30
}


export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const dias = periodoDeParam((await searchParams).periodo)
  await exigirSessao()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })

  
  if (!ws) {
    return (
      <CabecalhoPagina titulo="Painel" subtitulo="Nenhum espaço de trabalho ativo. Recarregue a página." />
    )
  }

  const agora = new Date()
  const membroId = await resolverMembroAtivo({ cliente, ws })
  
  
  
  
  const [k, etapas, travados, previstos, series] = await Promise.all([
    kpis(cliente, ws, agora, dias),
    negociosPorEtapa(cliente, ws),
    negociosParados(cliente, ws, DIAS_PARADO, agora, LINHAS_LISTA),
    negociosPrevistos(cliente, ws, DIAS_PREVISAO, agora, BUSCA_PREVISTOS),
    
    seriesKpi(cliente, ws, agora, dias),
  ])
  
  
  
  const parados = travados.itens

  
  
  const agendaItens = membroId
    ? await listarAgenda({ cliente, ws, membroId, escopo: 'minhas' })
    : []
  const atrasadas = agendaItens.filter((a) => classificarVencimento(a.vencimento, agora) === 'atrasada')
  const proximas = agendaItens.filter((a) => classificarVencimento(a.vencimento, agora) !== 'atrasada')

  
  const nomeEtapa = new Map(etapas.map((e) => [e.etapaId, e.nome]))
  const totalNegocios = etapas.reduce((acc, e) => acc + e.count, 0)

  
  
  
  
  
  
  
  
  
  
  
  const linhasParados: LinhaLista[] = parados.map((n) => ({
    id: n.id,
    
    
    avatar: <Avatar nome={n.pessoa ?? n.titulo} />,
    nome: n.titulo,
    subtitulo: `${nomeEtapa.get(n.etapaId) ?? 'Sem etapa'} · ${fraseParado(n.diasParado)}`,
    
    
    href: `/negocios/${n.id}`,
    pill: <Pill variante={n.diasParado >= DIAS_PARADO * 2 ? 'erro' : 'aviso'}>{n.diasParado}d</Pill>,
    valor: n.valor > 0 ? moedaBRL(n.valor) : undefined,
  }))

  
  
  
  const linhasPrevistos: LinhaLista[] = semOsParados(previstos, parados)
    .slice(0, LINHAS_LISTA)
    .map((n) => ({
      id: n.id,
      avatar: <Avatar nome={n.pessoa ?? n.titulo} />,
      nome: n.titulo,
      subtitulo: `${nomeEtapa.get(n.etapaId) ?? 'Sem etapa'} · ${frasePrevisao(n.diasAte)}`,
      href: `/negocios/${n.id}`,
      pill: <Pill variante={variantePrevisao(n.diasAte)}>{rotuloPrevisao(n.diasAte)}</Pill>,
      valor: n.valor > 0 ? moedaBRL(n.valor) : undefined,
    }))

  return (
    <>
      {}
      <CabecalhoPagina
        titulo="Painel"
        subtitulo={`Fechamento dos últimos ${dias} dias, comparado com os ${dias} anteriores.`}
        acoes={<SeletorPeriodo atual={dias} />}
      />

      {}
      <Slot ancora="painel.topo" />

      {}
      <div className={`${estilos.faixaKpi} ${mov.entra}`}>
        <KpiCard
          label="Valor em aberto"
          valor={moedaBRL(k.valorEmAberto)}
          nota={
            k.negociosAbertos === 0
              ? 'Nenhum negócio aberto'
              : `em ${k.negociosAbertos} ${k.negociosAbertos === 1 ? 'negócio' : 'negócios'}`
          }
          serie={series.valorEmAberto}
          cor="var(--acento)"
          semSerie="sem negócios no período"
        />
        <KpiCard
          label="Parados"
          valor={String(travados.total)}
          nota={
            travados.total === 0
              ? `Nada travado há mais de ${DIAS_PARADO} dias`
              : `sem mexer há mais de ${DIAS_PARADO} dias`
          }
          
          
          serie={null}
          cor="var(--aviso)"
          semSerie="sem histórico de etapa"
          semSerieDetalhe={
            'Este KPI não tem curva porque o banco não guarda em que etapa cada negócio ' +
            'estava a cada dia passado — só desde quando ele está na etapa ATUAL. ' +
            'Reconstruir a série a partir do que existe desenharia uma queda que não ' +
            'aconteceu. Os outros três KPIs saem de datas de evento e são exatos.'
          }
        />
        <KpiCard
          label="Ganhos no período"
          valor={moedaBRL(k.ganhos.atual)}
          delta={k.ganhos.variacao != null ? { valor: k.ganhos.variacao, rotulo: 'vs. anterior' } : undefined}
          nota={
            k.ganhos.variacao == null
              ? `${k.ganhosCount} fechado(s) · sem base anterior`
              : `${k.ganhosCount} ${k.ganhosCount === 1 ? 'negócio fechado' : 'negócios fechados'}`
          }
          
          
          
          serie={series.ganhos}
          cor="var(--ok)"
          semSerie="nada fechado no período"
        />
        <KpiCard
          label="Taxa de conversão"
          valor={`${k.conversao.atual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}
          
          
          delta={
            k.conversao.variacao
              ? { valor: k.conversao.variacao, rotulo: 'vs. anterior', unidade: 'pp' as const }
              : undefined
          }
          nota={k.conversao.variacao ? undefined : 'dos negócios decididos no período'}
          
          
          
          
          serie={series.conversao}
          cor="var(--acento)"
          semSerie="nada decidido no período"
        />
      </div>

      {}
      <div className={`${estilos.gridAcionavel} ${mov.entra} ${mov.escalona}`} style={{ '--i': 1 } as CSSProperties}>
        <MinhaAgenda atrasadas={atrasadas} proximas={proximas} agora={agora} />
        <ListCard
          titulo={`Parados há mais de ${DIAS_PARADO} dias`}
          
          
          meta={travados.total > 0 ? <b>{travados.total}</b> : undefined}
          linhas={linhasParados}
          vazio="Nada travado — todo negócio aberto andou recentemente."
        />
      </div>

      {}
      <div className={`${mov.entra} ${mov.escalona}`} style={{ '--i': 2 } as CSSProperties}>
        <ChartCard
          titulo="Valor por etapa"
          
          
          meta={
            totalNegocios > 0 ? (
              <>
                {totalNegocios} {totalNegocios === 1 ? 'negócio aberto' : 'negócios abertos'} ·{' '}
                <b>{moedaBRL(etapas.reduce((s, e) => s + e.valor, 0))}</b>
              </>
            ) : undefined
          }
        >
          {etapas.length === 0 ? (
            <div className={estilos.chartVazio}>
              Configure um pipeline padrão para ver o valor por etapa.
            </div>
          ) : totalNegocios === 0 ? (
            <div className={estilos.chartVazio}>
              Ainda não há negócios abertos. Cadastre o primeiro para ver onde o valor está.
            </div>
          ) : (
            <GraficoEtapas etapas={etapas} />
          )}
        </ChartCard>
      </div>

      {}
      <div className={`${mov.entra} ${mov.escalona}`} style={{ '--i': 3 } as CSSProperties}>
        <ListCard
          titulo="Fecha em breve"
          meta={linhasPrevistos.length > 0 ? <b>{linhasPrevistos.length}</b> : undefined}
          linhas={linhasPrevistos}
          vazio="Nenhum fechamento previsto. Informe a previsão no negócio para vê-lo aqui — os travados ficam no bloco de parados."
        />
      </div>
    </>
  )
}


