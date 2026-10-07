import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import estilos from './crm.module.css'

export type LinhaRel = {
  id: string
  principal: string
  secundario?: string | null
  badge?: React.ReactNode
  href: string
}


export default function Relacionados({
  titulo,
  itens,
  vazio,
}: {
  titulo: string
  itens: LinhaRel[]
  vazio: string
}) {
  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>{titulo}</h2>
      </div>
      {itens.length === 0 ? (
        <p className={estilos.relVazio}>{vazio}</p>
      ) : (
        <ul className={estilos.relLista}>
          {itens.map((i) => (
            <li key={i.id}>
              {}
              <Link href={i.href} className={estilos.relLinha}>
                <span className={estilos.relPrincipal}>{i.principal}</span>
                {i.badge && <span className={estilos.relBadge}>{i.badge}</span>}
                {i.secundario && <span className={estilos.relSecundario}>{i.secundario}</span>}
                <ChevronRight className={estilos.relSeta} size={15} strokeWidth={2} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
