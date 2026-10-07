'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { ChevronUp, LogOut } from 'lucide-react'
import { sairAction } from '@/server/auth/sair-action'
import Avatar from '@/components/ui/Avatar'
import SeletorTema from '@/components/ui/SeletorTema'
import { usarPopup } from '@/components/ui/usar-popup'
import type { Tema } from '@/lib/tema'
import estilos from './MenuUsuario.module.css'

export type UsuarioResumo = { nome: string; email: string }


export default function MenuUsuario({ user, tema }: { user: UsuarioResumo; tema: Tema }) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  
  const menuRef = usarPopup({ aberto, fechar: () => setAberto(false) })

  useEffect(() => {
    if (!aberto) return
    function aoClicar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicar)
    return () => document.removeEventListener('mousedown', aoClicar)
  }, [aberto])

  function aoSair() {
    iniciar(async () => {
      await sairAction()
      window.location.href = '/entrar'
    })
  }

  return (
    <div className={estilos.wrap} ref={ref}>
      <button
        type="button"
        className={estilos.gatilho}
        onClick={() => setAberto((v) => !v)}
        
        
        aria-expanded={aberto}
      >
        <Avatar nome={user.nome} tamanho="sm" />
        {}
        <span className={estilos.texto}>
          <b>{user.nome}</b>
        </span>
        {}
        <ChevronUp size={16} strokeWidth={2} className={estilos.chevron} />
      </button>

      {aberto && (
        <div className={estilos.menu} ref={menuRef}>
          <div className={estilos.cabecalho}>
            <b>{user.nome}</b>
            <small>{user.email}</small>
          </div>
          {}
          <SeletorTema tema={tema} className={estilos.tema} />
          <button
            type="button"
            className={estilos.item}
            onClick={aoSair}
            disabled={pendente}
          >
            <LogOut size={18} strokeWidth={1.75} />
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  )
}
