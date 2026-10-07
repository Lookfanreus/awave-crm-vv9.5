import type { CSSProperties } from 'react'
import { AlertTriangle, Inbox, Info, Layers } from 'lucide-react'
import { moedaBRL } from '@/lib/formato'
import { comprimentoBarra } from '@/lib/barra-grafico'
import { ROTULO_TIPO, type ResultadoRelatorio } from '@/lib/relatorios'
import EstadoVazio from '@/components/ui/EstadoVazio'
import KpiCard from '@/components/ui/KpiCard'
import GraficoFunil from './GraficoFunil'
import mov from '@/app/movimento.module.css'
import estilos from './relatorios.module.css'


export default function Resultado({ resultado }: { resultado: ResultadoRelatorio }) {
  const { aviso, funil } = resultado

  return (
    <section className={estilos.resultado}>
      <div className={estilos.blocoTopo}>
        <h2 className={estilos.subtitulo}>{ROTULO_TIPO[resultado.tipo]}</h2>
        <span className={estilos.meta}>
          {funil ? funil.nome : 'nenhum funil'} · {textoPeriodo(resultado.periodo)}
        </span>
      </div>

      {!funil && (
        <p className={estilos.vazio}>
          Este espaço de trabalho ainda não tem funil. Crie um em <b>Config → Funis</b> para começar a medir.
        </p>
      )}

      {aviso.truncado && (
        <p className={estilos.faixaAviso}>
          <AlertTriangle size={15} strokeWidth={2} />
          Amostra dos primeiros {aviso.teto.toLocaleString('pt-BR')} registros — há mais dados no
          período do que cabe numa consulta. Estreite o período para ver o total.
        </p>
      )}

      {funil && <Corpo resultado={resultado} />}

      {aviso.aproximados > 0 && aviso.corte && (
        <p className={estilos.rodape}>
          <Info size={14} strokeWidth={2} />
          {aviso.aproximados} {aviso.aproximados === 1 ? 'negócio contado' : 'negócios contados'} “desde a
          criação”: {aviso.aproximados === 1 ? 'ele já existia' : 'eles já existiam'} antes de{' '}
          {new Date(aviso.corte).toLocaleDateString('pt-BR')}, quando o CRM passou a registrar cada
          passagem de etapa. O histórico anterior a essa data é aproximado.
        </p>
      )}
    </section>
  )
}

function Corpo({ resultado }: { resultado: ResultadoRelatorio }) {
  switch (resultado.tipo) {
    case 'funil_conversao': {
      const total = resultado.linhas.reduce((s, l) => s + l.entraram, 0)
      if (total === 0) return <Vazio />
      
      
      
      const mensuraveis = resultado.linhas.filter((l) => l.taxaSeguinte !== null)
      const semAvanco = mensuraveis.length > 0 && mensuraveis.every((l) => l.taxaSeguinte === 0)
      return (
        <>
          {semAvanco && <SemAvanco corte={resultado.aviso.corte} />}
          <GraficoFunil linhas={resultado.linhas} />
        </>
      )
    }

    case 'tempo_por_etapa': {
      const maior = resultado.linhas.reduce((m, l) => Math.max(m, l.mediaDias ?? 0, l.medianaDias ?? 0), 0)
      if (resultado.linhas.every((l) => l.amostra === 0)) return <Vazio />
      return (
        <ul className={estilos.tempoLista}>
          {resultado.linhas.map((l, i) => (
            <li key={l.etapa_id} className={estilos.tempoItem}>
              <div className={estilos.tempoTopo}>
                <span className={estilos.tempoNome}>{l.nome ?? l.etapa_id}</span>
                {}
                <span className={estilos.amostra}>n = {l.amostra}</span>
              </div>
              {}
              <BarraMedida titulo="Média" dias={l.mediaDias} maior={maior} indice={i} />
              <BarraMedida titulo="Mediana" dias={l.medianaDias} maior={maior} indice={i} secundaria />
            </li>
          ))}
        </ul>
      )
    }

    case 'forecast': {
      const { total, considerados, semProbabilidade, semValor } = resultado.resultado
      return (
        <>
          {}
          <div className={estilos.faixaKpi}>
            <KpiCard
              label="Previsão"
              valor={moedaBRL(total)}
              nota="Soma dos valores × a probabilidade de cada etapa"
            />
            <KpiCard
              label="Negócios considerados"
              valor={considerados.toLocaleString('pt-BR')}
              nota="Em aberto e com valor preenchido"
            />
          </div>
          {}
          {semProbabilidade > 0 && (
            <p className={estilos.rodape}>
              <Info size={14} strokeWidth={2} />
              {semProbabilidade} {semProbabilidade === 1 ? 'negócio está' : 'negócios estão'} numa etapa
              sem probabilidade definida e {semProbabilidade === 1 ? 'contou' : 'contaram'} como zero.
              Defina a probabilidade em <b>Config → Funis</b>.
            </p>
          )}
          {semValor > 0 && (
            <p className={estilos.rodape}>
              <Info size={14} strokeWidth={2} />
              {semValor} {semValor === 1 ? 'negócio ficou' : 'negócios ficaram'} de fora por não ter valor
              preenchido.
            </p>
          )}
        </>
      )
    }

    case 'tabela': {
      if (resultado.grupos.length === 0) return <Vazio />
      const maior = resultado.grupos.reduce((m, g) => Math.max(m, g.contagem), 0)
      return (
        <>
          {resultado.agrupamento.multipla && (
            <p className={estilos.faixaInfo}>
              <Layers size={15} strokeWidth={2} />
              “{resultado.agrupamento.rotulo}” aceita várias opções por negócio, então o mesmo negócio
              conta em cada uma: a soma dos grupos é maior que os {resultado.totalNegocios} negócios do
              período.
            </p>
          )}
          <div className={estilos.tabelaWrap}>
            <table className={estilos.tabela}>
              <thead>
                <tr>
                  <th>{resultado.agrupamento.rotulo}</th>
                  <th className={estilos.tdNum}>Negócios</th>
                  <th className={estilos.tdNum}>Soma</th>
                </tr>
              </thead>
              <tbody>
                {resultado.grupos.map((g) => (
                  <tr key={g.chave ?? '@vazio'}>
                    <td>
                      <span className={g.chave === null ? estilos.rotuloVazio : undefined}>{g.rotulo}</span>
                      {}
                      <span className={`${estilos.trilhoFino} ${estilos.barraCelula}`} aria-hidden>
                        <span
                          className={`${estilos.barra} ${mov.cresce}`}
                          style={{ width: `${comprimentoBarra(g.contagem, maior)}%` }}
                        />
                      </span>
                    </td>
                    <td className={estilos.tdNum}>{g.contagem}</td>
                    <td className={estilos.tdNum}>{moedaBRL(g.soma)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )
    }
  }
}


function BarraMedida({ titulo, dias, maior, indice, secundaria }: {
  titulo: string; dias: number | null; maior: number; indice: number; secundaria?: boolean
}) {
  return (
    <div className={estilos.medida}>
      <span className={estilos.medidaRotulo}>{titulo}</span>
      <span className={secundaria ? estilos.trilhoFino : estilos.trilho} aria-hidden>
        <span
          className={`${estilos.barra} ${mov.cresce} ${mov.escalona}`}
          
          
          
          style={{ width: `${comprimentoBarra(dias ?? 0, maior)}%`, '--i': indice } as CSSProperties}
        />
      </span>
      {}
      <span className={estilos.medidaValor}>
        {dias === null ? '—' : `${dias.toLocaleString('pt-BR')} ${dias === 1 ? 'dia' : 'dias'}`}
      </span>
    </div>
  )
}


function Vazio() {
  return (
    <EstadoVazio
      icone={<Inbox size={20} strokeWidth={1.75} />}
      titulo="Nenhum negócio no período"
      texto="Ninguém passou por este funil nas datas escolhidas. Amplie o período (ou deixe as datas em branco) para ver todo o histórico."
    />
  )
}


function SemAvanco({ corte }: { corte: string | null }) {
  return (
    <p className={estilos.faixaInfo}>
      <Info size={15} strokeWidth={2} />
      <span>
        <b>Ainda não há avanço para medir.</b> O CRM não registrou nenhuma mudança de etapa neste
        período, por isso todas as taxas abaixo estão em 0%. Isso não quer dizer que ninguém
        avançou — quer dizer que não existe passagem registrada para calcular.{' '}
        {corte && (
          <>
            O registro de cada mudança começou em{' '}
            {new Date(corte).toLocaleDateString('pt-BR')}: quem já estava na etapa atual antes
            dessa data não conta como avanço.{' '}
          </>
        )}
        A taxa aparece assim que um negócio mudar de etapa.
      </span>
    </p>
  )
}

function textoPeriodo({ de, ate }: { de: string | null; ate: string | null }): string {
  const br = (d: string) => d.split('-').reverse().join('/')
  if (de && ate) return `${br(de)} a ${br(ate)}`
  if (de) return `de ${br(de)}`
  if (ate) return `até ${br(ate)}`
  return 'todo o período'
}
