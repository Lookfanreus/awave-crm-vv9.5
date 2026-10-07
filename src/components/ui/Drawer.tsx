'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import Botao from './Botao'
import estilos from './Drawer.module.css'

export interface DrawerProps {
  aberto: boolean
  titulo: string
  onFechar: () => void
  children: React.ReactNode
}


export default function Drawer({ aberto, titulo, onFechar, children }: DrawerProps) {
  
  useEffect(() => {
    if (!aberto) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, onFechar])

  if (!aberto) return null

  return (
    <>
      {}
      <div className={estilos.overlay} aria-hidden="true" onClick={onFechar} />

      {}
      <div
        className={estilos.painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className={estilos.header}>
          <span className={estilos.titulo}>{titulo}</span>
          <Botao variante="fantasma" soIcone
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <X size={18} strokeWidth={2} />
          </Botao>
        </div>

        <div className={estilos.corpo}>{children}</div>
      </div>
    </>
  )
}
