'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import estilos from './NavMobile.module.css'



type ContextoNav = { aberto: boolean; abrir: () => void; fechar: () => void }

const NavMobileContext = createContext<ContextoNav | null>(null)

function useNavMobile(): ContextoNav {
  const ctx = useContext(NavMobileContext)
  if (!ctx) throw new Error('useNavMobile deve ser usado dentro de <NavMobileProvider>')
  return ctx
}

export function NavMobileProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()

  const abrir = useCallback(() => setAberto(true), [])
  const fechar = useCallback(() => setAberto(false), [])

  
  useEffect(() => { setAberto(false) }, [pathname])

  useEffect(() => {
    if (!aberto) return

    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    
    
    const mq = window.matchMedia('(min-width: 1025px)')
    const aoMudarLargura = () => { if (mq.matches) setAberto(false) }

    document.addEventListener('keydown', aoTeclar)
    mq.addEventListener('change', aoMudarLargura)
    const overflowAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden' 

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      mq.removeEventListener('change', aoMudarLargura)
      document.body.style.overflow = overflowAntes
    }
  }, [aberto])

  return (
    <NavMobileContext.Provider value={{ aberto, abrir, fechar }}>
      {children}
    </NavMobileContext.Provider>
  )
}


export function BarraMobile() {
  return (
    <header className={estilos.barraMobile}>
      <BotaoMenu />
    </header>
  )
}


export function BotaoMenu() {
  const { aberto, abrir } = useNavMobile()
  return (
    <button
      type="button"
      className={estilos.botao}
      onClick={abrir}
      aria-label="Abrir menu"
      aria-expanded={aberto}
      aria-controls="gaveta-nav"
    >
      <Menu size={20} strokeWidth={1.75} />
    </button>
  )
}


export function GavetaRail({ children }: { children: React.ReactNode }) {
  const { aberto, fechar } = useNavMobile()
  const gaveta = useRef<HTMLDivElement>(null)
  const focoAnterior = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (aberto) {
      focoAnterior.current = document.activeElement as HTMLElement | null
      gaveta.current?.focus()
      return
    }
    
    focoAnterior.current?.focus()
    focoAnterior.current = null
  }, [aberto])

  return (
    <>
      <div
        id="gaveta-nav"
        ref={gaveta}
        tabIndex={-1}
        className={estilos.gaveta}
        data-aberto={aberto}
      >
        {children}
      </div>
      {aberto && <div className={estilos.overlay} onClick={fechar} aria-hidden />}
    </>
  )
}
