'use client'

import { createContext, useContext, useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import estilos from './Campo.module.css'



type Contexto = {
  id: string
  
  descritores: string | undefined
  invalido: boolean
  obrigatorio: boolean
}

const CampoContexto = createContext<Contexto | null>(null)

export function Campo({
  id: idFixo,
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  className,
  children,
}: {
  
  id?: string
  rotulo: string
  
  ajuda?: ReactNode
  
  erro?: ReactNode
  obrigatorio?: boolean
  className?: string
  children: ReactNode
}) {
  
  
  const gerado = useId()
  const id = idFixo ?? gerado
  const idAjuda = `${id}-ajuda`
  const idErro = `${id}-erro`

  const descritores =
    [ajuda ? idAjuda : '', erro ? idErro : ''].filter(Boolean).join(' ') || undefined

  return (
    <CampoContexto.Provider
      value={{ id, descritores, invalido: Boolean(erro), obrigatorio: Boolean(obrigatorio) }}
    >
      <div className={className ? `${estilos.campo} ${className}` : estilos.campo}>
        <label className={estilos.rotulo} htmlFor={id}>
          {rotulo}
          {obrigatorio && (
            
            
            <span className={estilos.marcaObrigatorio} aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>

        {children}

        {ajuda && (
          <p className={estilos.ajuda} id={idAjuda}>
            {ajuda}
          </p>
        )}
        {erro && (
          <p className={estilos.mensagemErro} id={idErro}>
            {erro}
          </p>
        )}
      </div>
    </CampoContexto.Provider>
  )
}


type Amarraveis = {
  id?: string
  required?: boolean
  'aria-describedby'?: string
  
  'aria-invalid'?: InputHTMLAttributes<HTMLInputElement>['aria-invalid']
}

function amarrar<P extends Amarraveis>(props: P, ctx: Contexto | null): P {
  if (!ctx) return props
  return {
    ...props,
    id: props.id ?? ctx.id,
    required: props.required ?? (ctx.obrigatorio || undefined),
    'aria-describedby': props['aria-describedby'] ?? ctx.descritores,
    'aria-invalid': props['aria-invalid'] ?? (ctx.invalido || undefined),
  }
}

function juntar(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base
}

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const ctx = useContext(CampoContexto)
  return <input {...amarrar(props, ctx)} className={juntar(estilos.controle, className)} />
}

export function Selecao({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const ctx = useContext(CampoContexto)
  return (
    <select
      {...amarrar(props, ctx)}
      className={juntar(`${estilos.controle} ${estilos.selecao}`, className)}
    />
  )
}

export function AreaTexto({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ctx = useContext(CampoContexto)
  return (
    <textarea
      {...amarrar(props, ctx)}
      className={juntar(`${estilos.controle} ${estilos.areaTexto}`, className)}
    />
  )
}
