'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { iconeDoTipo } from '@/app/(app)/_crm/iconesTipo'
import AcoesAgenda from '@/app/(app)/_crm/AcoesAgenda'
import { dataAgenda } from '@/lib/formato'
import type { ItemAgenda } from '@/server/crm/agenda-consulta'
import estilos from './agenda.module.css'
import mov from '@/app/movimento.module.css'


export default function LinhaAgenda({
  item,
  atrasada,
  indice,
}: {
  item: ItemAgenda
  atrasada?: boolean
  indice: number
}) {
  const Icone = iconeDoTipo(item.tipo.icone)
  const alvo = item.negocio
    ? { href: `/negocios/${item.negocio.id}`, nome: item.negocio.titulo }
    : item.contato
      ? { href: `/contatos/${item.contato.id}`, nome: item.contato.nome }
      : null

  return (
    <li
      className={`${estilos.linha} ${mov.entra} ${mov.escalona}`}
      style={{ '--i': indice } as CSSProperties}
    >
      <span className={atrasada ? estilos.quandoAtraso : estilos.quando}>
        {dataAgenda(item.vencimento)}
      </span>
      <span className={estilos.icone} aria-hidden="true">
        <Icone size={16} />
      </span>
      <p className={estilos.titulo}>{item.conteudo?.trim() || item.tipo.nome}</p>
      {alvo ? (
        <Link href={alvo.href} className={estilos.alvo}>
          {alvo.nome}
        </Link>
      ) : (
        
        
        <span className={estilos.alvo}>—</span>
      )}
      <div className={estilos.acoes}>
        <AcoesAgenda id={item.id} vencimento={item.vencimento} />
      </div>
    </li>
  )
}
