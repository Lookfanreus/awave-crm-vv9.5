'use client'

import { useEffect, useRef } from 'react'
import { popupEraDonoDoFoco } from '@/lib/foco-popup'


const FOCAVEL = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'


export function usarPopup({
  aberto,
  fechar,
  moverFocoAoAbrir = false,
}: {
  aberto: boolean
  fechar: () => void
  moverFocoAoAbrir?: boolean
}) {
  const popup = useRef<HTMLDivElement | null>(null)
  
  const gatilho = useRef<HTMLElement | null>(null)
  
  const noDoPopup = useRef<HTMLElement | null>(null)

  
  
  
  
  
  const fecharRef = useRef(fechar)
  useEffect(() => { fecharRef.current = fechar })

  useEffect(() => {
    if (!aberto) return

    gatilho.current = document.activeElement as HTMLElement | null
    noDoPopup.current = popup.current

    if (moverFocoAoAbrir) popup.current?.querySelector<HTMLElement>(FOCAVEL)?.focus()

    
    
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharRef.current() }
    document.addEventListener('keydown', aoTeclar)

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      const foco = document.activeElement
      const dentro = !!(foco && noDoPopup.current?.contains(foco))
      if (popupEraDonoDoFoco(foco, document.body, dentro)) gatilho.current?.focus()
      gatilho.current = null
      noDoPopup.current = null
    }
  }, [aberto, moverFocoAoAbrir])

  return popup
}


