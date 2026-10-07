'use client'

import { mensagemGate } from '@/lib/mensagem-gate'
import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown } from 'lucide-react'
import { mudarEtapa } from '@/server/crm/acoes'
import { usarPopup } from '@/components/ui/usar-popup'
import Botao from '@/components/ui/Botao'
import estilos from './crm.module.css'


export default function SeletorEtapa({
  negocioId,
  etapas,
  etapaAtualId,
}: {
  negocioId: string
  etapas: { id: string; nome: string; ordem: number }[]
  etapaAtualId: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  
  const menuRef = usarPopup({ aberto, fechar: () => setAberto(false) })

  const etapaAtual = etapas.find((e) => e.id === etapaAtualId)

  
  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function escolher(etapaId: string) {
    setAberto(false)
    if (etapaId === etapaAtualId) return
    setErroMsg(null)
    iniciar(async () => {
      const r = await mudarEtapa(negocioId, etapaId)
      if ('erro' in r) {
        setErroMsg(mensagemGate(r.erro, 'campos' in r ? r.campos : undefined, 'Não foi possível mudar a etapa. Tente novamente.'))
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
          <span>{etapaAtual?.nome ?? 'Etapa'}</span>
          <ChevronsUpDown size={14} strokeWidth={1.75} />
        </Botao>

        {aberto && (
          <div className={estilos.seletorMenu} ref={menuRef}>
            {etapas.map((e) => {
              const ativo = e.id === etapaAtualId
              return (
                <button
                  key={e.id}
                  type="button"
                  
                  aria-current={ativo ? 'true' : undefined}
                  className={`${estilos.seletorItem} ${ativo ? estilos.seletorItemAtivo : ''}`}
                  onClick={() => escolher(e.id)}
                >
                  <span>{e.nome}</span>
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
