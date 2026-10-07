import { History } from 'lucide-react'
import type { AtividadeTimeline } from '@/server/crm/detalhes'
import { dataRelativa, dataAgenda } from '@/lib/formato'
import EstadoVazio from '@/components/ui/EstadoVazio'
import { iconeDoTipo } from './iconesTipo'
import AcoesAgenda from './AcoesAgenda'
import ExcluirAtividade from './ExcluirAtividade'
import estilos from './crm.module.css'


function iconeParaTipo(tipo: AtividadeTimeline['tipo']): { icone: React.ReactNode; classe: string } {
  const Icone = iconeDoTipo(tipo.icone)
  const classe = tipo.slug === 'resumo_ia' ? estilos.timelineIconeIa
    : tipo.slug === 'etapa_mudou' ? estilos.timelineIconeEtapa
    : estilos.timelineIcone
  return { icone: <Icone size={13} />, classe }
}


function rotuloAutor(autor: string): string {
  return autor === 'ia' ? 'IA' : 'Equipe'
}


export default function Timeline({ atividades }: { atividades: AtividadeTimeline[] }) {
  
  
  const agora = new Date()
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Atividades</h2>
        {atividades.length > 0 && <span className={estilos.blocoMeta}>{atividades.length}</span>}
      </div>

      {atividades.length === 0 ? (
        <EstadoVazio
          icone={<History size={20} />}
          titulo="Nada registrado ainda"
          texto="Ligações, reuniões e notas aparecem aqui em ordem, da mais recente pra mais antiga."
        />
      ) : (
        <ul className={`${estilos.timelineLista} ${estilos.blocoCorpo}`}>
          {atividades.map((a) => {
            const { icone, classe } = iconeParaTipo(a.tipo)
            const agendadaAberta = a.vencimento != null && a.concluida_em == null
            const atrasada = agendadaAberta && new Date(a.vencimento as string) < inicioHoje
            return (
              <li key={a.id} className={estilos.timelineItem}>
                <span className={classe} aria-hidden="true">
                  {icone}
                </span>
                <div className={estilos.timelineCorpo}>
                  <p className={estilos.timelineConteudo}>
                    {a.conteudo ?? '—'}
                  </p>
                  <small className={estilos.timelineCaption}>
                    {rotuloAutor(a.autor)} · {dataRelativa(a.criado_em)}
                    {agendadaAberta && (
                      <> · <span className={atrasada ? estilos.timelineAtraso : estilos.timelineAgendada}>
                        agendada {dataAgenda(a.vencimento as string)}
                      </span></>
                    )}
                  </small>
                  {}
                  <div className={estilos.timelineAcoes}>
                    {agendadaAberta && (
                      <AcoesAgenda id={a.id} vencimento={a.vencimento as string} />
                    )}
                    <ExcluirAtividade id={a.id} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
