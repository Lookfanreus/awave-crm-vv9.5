'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, UserRound } from 'lucide-react'
import { salvarNegocio } from '@/server/crm/acoes'
import { usarPopup } from '@/components/ui/usar-popup'
import Botao from '@/components/ui/Botao'
import Avatar from '@/components/ui/Avatar'
import estilos from './crm.module.css'


export default function SeletorResponsavel({
  negocioId,
  pessoas,
  responsavelAtualId,
}: {
  negocioId: string
  pessoas: { id: string; nome: string }[]
  responsavelAtualId: string | null
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  
  const menuRef = usarPopup({ aberto, fechar: () => setAberto(false) })

  const atual = pessoas.find((p) => p.id === responsavelAtualId)

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function escolher(id: string | null) {
    setAberto(false)
    if (id === responsavelAtualId) return
    setErroMsg(null)
    iniciar(async () => {
      
      
      
      const r = await salvarNegocio({ id: negocioId, responsavel_id: id })
      if ('erro' in r) {
        setErroMsg(
          r.erro === 'responsavel_invalido'
            ? 'Essa pessoa não é mais membro deste espaço de trabalho. Recarregue a página.'
            : 'Não foi possível trocar o responsável. Tente novamente.',
        )
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
          {}
          {atual
            ? <Avatar nome={atual.nome} tamanho="sm" />
            : <UserRound size={14} strokeWidth={1.75} aria-hidden />}
          <span>{atual?.nome ?? 'Sem responsável'}</span>
          <ChevronsUpDown size={14} strokeWidth={1.75} />
        </Botao>

        {aberto && (
          <div className={estilos.seletorMenu} ref={menuRef}>
            {}
            <button
              type="button"
              aria-current={responsavelAtualId === null ? 'true' : undefined}
              className={`${estilos.seletorItem} ${responsavelAtualId === null ? estilos.seletorItemAtivo : ''}`}
              onClick={() => escolher(null)}
            >
              <span>Sem responsável</span>
              {responsavelAtualId === null && <Check size={14} strokeWidth={2} />}
            </button>

            {pessoas.map((p) => {
              const ativo = p.id === responsavelAtualId
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-current={ativo ? 'true' : undefined}
                  className={`${estilos.seletorItem} ${ativo ? estilos.seletorItemAtivo : ''}`}
                  onClick={() => escolher(p.id)}
                >
                  <span className={estilos.seletorPessoa}>
                    <Avatar nome={p.nome} tamanho="sm" />
                    {p.nome}
                  </span>
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
