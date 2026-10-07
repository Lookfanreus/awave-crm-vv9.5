'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { trocarWorkspace } from '@/server/auth/trocar-workspace'
import { usarPopup } from '@/components/ui/usar-popup'
import estilos from './SeletorWorkspace.module.css'

export type WorkspaceOpcao = { id: string; nome: string }


export default function SeletorWorkspace({
  workspaces,
  wsAtivo,
}: {
  workspaces: WorkspaceOpcao[]
  wsAtivo: string
}) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  
  
  const menuRef = usarPopup({ aberto, fechar: () => setAberto(false) })

  const ativo = workspaces.find((w) => w.id === wsAtivo)

  
  useEffect(() => {
    if (!aberto) return
    function aoClicar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicar)
    return () => document.removeEventListener('mousedown', aoClicar)
  }, [aberto])

  function escolher(id: string) {
    setAberto(false)
    if (id === wsAtivo) return
    iniciar(() => {
      void trocarWorkspace(id)
    })
  }

  return (
    <div className={estilos.wrap} ref={ref}>
      <button
        type="button"
        className={estilos.gatilho}
        onClick={() => setAberto((v) => !v)}
        disabled={pendente}
        
        
        
        
        aria-expanded={aberto}
      >
        <span className={estilos.nome}>{ativo?.nome ?? 'Selecionar espaço de trabalho'}</span>
        <ChevronsUpDown size={16} strokeWidth={1.75} />
      </button>

      {aberto && (
        <div className={estilos.menu} ref={menuRef}>
          <div className={estilos.rotulo}>Workspaces</div>
          {workspaces.map((w) => {
            const ativoItem = w.id === wsAtivo
            return (
              <button
                key={w.id}
                type="button"
                
                
                aria-current={ativoItem ? 'true' : undefined}
                className={`${estilos.item} ${ativoItem ? estilos.itemAtivo : ''}`}
                onClick={() => escolher(w.id)}
              >
                <span className={estilos.itemNome}>{w.nome}</span>
                {ativoItem && <Check size={16} strokeWidth={2} className={estilos.check} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
