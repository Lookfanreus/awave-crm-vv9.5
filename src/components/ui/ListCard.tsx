import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import estilos from './ListCard.module.css'


export type LinhaLista = {
  id: string
  avatar?: React.ReactNode
  nome: string
  subtitulo?: string
  
  href?: string
  
  pill?: React.ReactNode
  valor?: string
  nota?: string
}


export default function ListCard({
  titulo,
  meta,
  linhas,
  vazio = 'Nada por aqui ainda.',
}: {
  titulo: string
  
  meta?: React.ReactNode
  linhas: LinhaLista[]
  
  vazio?: React.ReactNode
}) {
  return (
    <section className={estilos.bloco}>
      <div className={estilos.header}>
        <h2 className={estilos.titulo}>{titulo}</h2>
        {meta ? <span className={estilos.meta}>{meta}</span> : null}
      </div>

      {linhas.length === 0 ? (
        <div className={estilos.vazio}>{vazio}</div>
      ) : (
        <ul className={estilos.lista}>
          {linhas.map((l) => {
            const conteudo = (
              <>
                {l.avatar ? <span className={estilos.avatar}>{l.avatar}</span> : null}
                <div className={estilos.quem}>
                  <b>{l.nome}</b>
                  {l.subtitulo ? <small>{l.subtitulo}</small> : null}
                </div>
                {l.pill ? <span className={estilos.pill}>{l.pill}</span> : null}
                {l.valor || l.nota ? (
                  <div className={estilos.trailing}>
                    {l.valor ? <b>{l.valor}</b> : null}
                    {l.nota ? <small>{l.nota}</small> : null}
                  </div>
                ) : null}
                {l.href ? (
                  <ChevronRight className={estilos.seta} size={15} strokeWidth={2} aria-hidden />
                ) : null}
              </>
            )
            return (
              <li key={l.id} className={estilos.item}>
                {l.href ? (
                  <Link href={l.href} className={`${estilos.linha} ${estilos.clicavel}`}>
                    {conteudo}
                  </Link>
                ) : (
                  <div className={estilos.linha}>{conteudo}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
