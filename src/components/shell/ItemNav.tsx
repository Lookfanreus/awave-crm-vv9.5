'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import estilos from './Rail.module.css'


export default function ItemNav({ href, rotulo, children, aviso }: {
  href: string
  rotulo: string
  children: React.ReactNode  
  
  aviso?: boolean
}) {
  const pathname = usePathname()
  
  
  
  
  
  
  
  const exato = pathname === href
  const ativo = exato || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={`${estilos.nav} ${ativo ? estilos.ativo : ''}`}
      aria-current={exato ? 'page' : ativo ? 'true' : undefined}
    >
      {children}
      <span>{rotulo}</span>
      {}
      {aviso ? (
        <span className={estilos.aviso} role="status" aria-label="Atualização disponível" title="Atualização disponível" />
      ) : null}
    </Link>
  )
}
