'use client'

import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import estilos from './Botao.module.css'



type Variante = 'primario' | 'secundario' | 'fantasma'
type Tom = 'ok' | 'erro'
type Tamanho = 'medio' | 'pequeno'

type Comuns = {
  
  variante?: Variante
  
  tom?: Tom
  tamanho?: Tamanho
  
  soIcone?: boolean
  larguraTotal?: boolean
  
  carregando?: boolean
  
  desabilitado?: boolean
  
  className?: string
  children?: ReactNode
}

type PropsBotao = Comuns &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'disabled'> & {
    href?: undefined
  }

type PropsLink = Comuns &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & {
    href: string
  }


export type PropsDoBotao = PropsLink | PropsBotao

export default function Botao(props: PropsDoBotao) {
  const {
    variante = 'secundario',
    tom,
    tamanho = 'medio',
    soIcone,
    larguraTotal,
    carregando,
    desabilitado,
    className,
    children,
    ...resto
  } = props as Comuns & { href?: string } & Record<string, unknown>

  const classes = [
    estilos.raiz,
    estilos[variante],
    estilos[tamanho],
    soIcone ? estilos.soIcone : '',
    larguraTotal ? estilos.larguraTotal : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  
  function aoClicar(evento: MouseEvent<HTMLButtonElement & HTMLAnchorElement>) {
    if (carregando) {
      evento.preventDefault()
      evento.stopPropagation()
      return
    }
    ;(resto.onClick as ((e: typeof evento) => void) | undefined)?.(evento)
  }

  const comuns = {
    className: classes,
    'data-tom': tom,
    'aria-disabled': carregando ? true : undefined,
    'aria-busy': carregando ? true : undefined,
    onClick: aoClicar,
  }

  if (typeof resto.href === 'string') {
    const { href, ...restoLink } = resto as { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>
    
    
    const interno = href.startsWith('/') && restoLink.download === undefined
    if (interno) {
      return (
        <Link {...restoLink} href={href} {...comuns}>
          {children}
        </Link>
      )
    }
    return (
      <a {...restoLink} href={href} {...comuns}>
        {children}
      </a>
    )
  }

  const restoBotao = resto as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button {...restoBotao} disabled={desabilitado} {...comuns}>
      {children}
    </button>
  )
}
