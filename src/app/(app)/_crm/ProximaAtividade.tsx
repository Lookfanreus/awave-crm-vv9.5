'use client'

import { iconeDoTipo } from './iconesTipo'
import AcoesAgenda from './AcoesAgenda'
import { dataAgenda } from '@/lib/formato'
import type { AtividadeTimeline } from '@/server/crm/detalhes'
import estilos from './proximaAtividade.module.css'


export default function ProximaAtividade({
  proxima,
  atrasada,
  negocioAberto,
}: {
  proxima: AtividadeTimeline | null
  atrasada: boolean
  negocioAberto: boolean
}) {
  if (!proxima || proxima.vencimento == null) {
    if (!negocioAberto) return null
    return (
      <div className={estilos.nudge}>
        Sem próxima atividade — agende uma pra não perder o timing.
      </div>
    )
  }

  const Icone = iconeDoTipo(proxima.tipo.icone)
  return (
    <div className={`${estilos.bloco}${atrasada ? ` ${estilos.blocoAtraso}` : ''}`}>
      <span className={`${estilos.rotulo}${atrasada ? ` ${estilos.rotuloAtraso}` : ''}`}>
        {atrasada ? 'Próxima atividade — atrasada' : 'Próxima atividade'}
      </span>
      <div className={estilos.corpo}>
        <span
          className={`${estilos.icone}${atrasada ? ` ${estilos.iconeAtraso}` : ''}`}
          aria-hidden="true"
        >
          <Icone size={13} />
        </span>
        <div className={estilos.info}>
          <p className={estilos.conteudo}>{proxima.conteudo?.trim() || proxima.tipo.nome}</p>
          <small className={atrasada ? estilos.quandoAtraso : estilos.quando}>{dataAgenda(proxima.vencimento)}</small>
        </div>
        <AcoesAgenda id={proxima.id} vencimento={proxima.vencimento} />
      </div>
    </div>
  )
}
