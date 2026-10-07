'use client'

import { useRef, useTransition } from 'react'
import { Sun, Moon } from 'lucide-react'
import { salvarTema } from '@/app/(app)/config/acoes-tema'
import { atributoTema, type Tema } from '@/lib/tema'
import estilos from './SeletorTema.module.css'


const OPCOES = [
  { valor: 'claro', rotulo: 'Claro', Icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', Icone: Moon },
] as const


export default function SeletorTema({
  tema,
  className,
}: {
  tema: Tema
  
  className?: string
}) {
  const [pendente, iniciar] = useTransition()
  
  
  
  const emVoo = useRef(false)

  function escolher(alvo: Tema) {
    if (emVoo.current) return
    emVoo.current = true
    iniciar(async () => {
      try {
        
        
        
        const resultado = await salvarTema(alvo)

        
        
        
        
        
        
        if ('ok' in resultado) {
          const atributo = atributoTema(alvo)
          if (atributo) document.documentElement.dataset.tema = atributo
          else delete document.documentElement.dataset.tema
        }
      } catch {
        
        
        
        
      } finally {
        emVoo.current = false
      }
    })
  }

  return (
    <div
      className={className ? `${estilos.grupo} ${className}` : estilos.grupo}
      role="group"
      aria-label="Tema da interface"
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          className={estilos.opcao}
          
          
          
          aria-pressed={tema === valor}
          
          
          
          
          aria-disabled={pendente}
          onClick={() => escolher(valor)}
        >
          <Icone size={16} strokeWidth={2} aria-hidden="true" />
          {}
          <span>{rotulo}</span>
        </button>
      ))}
    </div>
  )
}
