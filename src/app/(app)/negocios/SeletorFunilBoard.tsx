'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown } from 'lucide-react'
import { usarPopup } from '@/components/ui/usar-popup'
import Botao from '@/components/ui/Botao'
import estilos from '@/app/(app)/_crm/crm.module.css'


export default function SeletorFunilBoard({
  funis,
  atualId,
}: {
  funis: { id: string; nome: string; is_padrao: boolean }[]
  atualId: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  
  const menuRef = usarPopup({ aberto, fechar: () => setAberto(false) })

  const funilAtual = funis.find((f) => f.id === atualId)

  
  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function escolher(id: string) {
    setAberto(false)
    if (id === atualId) return
    router.push('/negocios?funil=' + id)
  }

  return (
    <div className={estilos.seletorWrap} ref={ref}>
      <Botao 
        type="button"
        onClick={() => setAberto((v) => !v)}
        
        
        aria-expanded={aberto}
      >
        <span>{funilAtual?.nome ?? 'Funil'}</span>
        <ChevronsUpDown size={14} strokeWidth={1.75} />
      </Botao>

      {aberto && (
        <div className={estilos.seletorMenu} ref={menuRef}>
          {funis.map((f) => {
            const ativo = f.id === atualId
            return (
              <button
                key={f.id}
                type="button"
                
                aria-current={ativo ? 'true' : undefined}
                className={`${estilos.seletorItem} ${ativo ? estilos.seletorItemAtivo : ''}`}
                onClick={() => escolher(f.id)}
              >
                <span>{f.nome}</span>
                {ativo && <Check size={14} strokeWidth={2} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
