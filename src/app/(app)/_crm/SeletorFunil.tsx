'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown } from 'lucide-react'
import { mudarFunil } from '@/server/crm/acoes'
import { usarPopup } from '@/components/ui/usar-popup'
import Botao from '@/components/ui/Botao'
import estilos from './crm.module.css'


export default function SeletorFunil({
  negocioId,
  funis,
  funilAtualId,
}: {
  negocioId: string
  funis: { id: string; nome: string }[]
  funilAtualId: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  
  const menuRef = usarPopup({ aberto, fechar: () => setAberto(false) })

  const funilAtual = funis.find((f) => f.id === funilAtualId)

  
  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function escolher(funilId: string) {
    setAberto(false)
    if (funilId === funilAtualId) return
    setErroMsg(null)
    iniciar(async () => {
      const r = await mudarFunil(negocioId, funilId)
      if ('erro' in r) {
        const msgs: Record<string, string> = {
          funil_sem_etapa: 'Este funil não tem etapas. Crie uma etapa antes.',
          funil_nao_encontrado: 'Funil não encontrado.',
          negocio_nao_encontrado: 'Negócio não encontrado.',
        }
        setErroMsg(msgs[r.erro] ?? 'Não foi possível mudar de funil. Tente novamente.')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div>
      <div className={estilos.seletorWrap} ref={ref}>
        <Botao
          type="button"
          onClick={() => setAberto((v) => !v)}
          carregando={pendente}
          
          
          aria-expanded={aberto}
        >
          <span>{funilAtual?.nome ?? 'Funil'}</span>
          <ChevronsUpDown size={14} strokeWidth={1.75} />
        </Botao>

        {aberto && (
          <div className={estilos.seletorMenu} ref={menuRef}>
            {funis.map((f) => {
              const ativo = f.id === funilAtualId
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
      {erroMsg && <p className={`${estilos.erro} ${estilos.erroInline}`}>{erroMsg}</p>}
    </div>
  )
}
