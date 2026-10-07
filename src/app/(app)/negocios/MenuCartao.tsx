'use client'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { MoreVertical, Trophy, XCircle, Copy } from 'lucide-react'
import { ganharNegocio, perderNegocio } from './actions'
import { mensagemGate } from '@/lib/mensagem-gate'
import { duplicarNegocio } from '@/server/crm/duplicar'
import { usarPopup } from '@/components/ui/usar-popup'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './kanban.module.css'


const LARGURA_MENU = 190

const ALTURA_MENU = 140

export default function MenuCartao({ cartaoId, onRemover, onErro }: {
  cartaoId: string
  onRemover: (id: string) => () => void
  onErro: (msg: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [modoPerder, setModoPerder] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null)

  const fechar = useCallback(() => { setAberto(false); setModoPerder(false); setMotivo('') }, [])

  
  const aoEscapar = useCallback(() => {
    if (modoPerder) { setModoPerder(false); setMotivo(''); return }
    fechar()
  }, [modoPerder, fechar])

  
  
  
  
  
  
  
  
  
  
  const menuRef = usarPopup({
    aberto: aberto && posicao !== null,
    fechar: aoEscapar,
    moverFocoAoAbrir: true,
  })

  
  
  
  
  
  
  
  
  
  

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  useLayoutEffect(() => {
    if (!aberto) { setPosicao(null); return }
    const g = gatilhoRef.current
    if (!g) return
    const r = g.getBoundingClientRect()
    
    
    const left = Math.max(8, Math.min(r.right - LARGURA_MENU, window.innerWidth - LARGURA_MENU - 8))
    
    const cabeAbaixo = window.innerHeight - r.bottom > ALTURA_MENU
    const top = cabeAbaixo ? r.bottom + 4 : Math.max(8, r.top - ALTURA_MENU - 4)
    setPosicao({ top, left })
  }, [aberto, modoPerder])

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      const alvo = e.target as Node
      
      
      
      
      if (ref.current?.contains(alvo) || menuRef.current?.contains(alvo)) return
      fechar()
    }
    
    
    
    function aoRolar() { fechar() }
    document.addEventListener('mousedown', fora)
    window.addEventListener('scroll', aoRolar, true)
    window.addEventListener('resize', aoRolar)
    return () => {
      document.removeEventListener('mousedown', fora)
      window.removeEventListener('scroll', aoRolar, true)
      window.removeEventListener('resize', aoRolar)
    }
  }, [aberto, fechar])

  function ganhar() {
    setAberto(false)
    const desfazer = onRemover(cartaoId)
    iniciar(async () => {
      const r = await ganharNegocio(cartaoId)
      if ('erro' in r) {
        desfazer()
        
        
        
        
        
        
        
        
        
        
        
        
        onErro(mensagemGate(r.erro, r.campos, 'Não foi possível marcar como ganho.'))
      }
    })
  }
  
  function duplicar() {
    setAberto(false)
    iniciar(async () => {
      const r = await duplicarNegocio({ id: cartaoId })
      if ('erro' in r) onErro('Não foi possível duplicar. Tente de novo.')
      else window.location.assign('/negocios')
    })
  }

  function perder() {
    const m = motivo.trim()
    if (!m) return
    setAberto(false); setModoPerder(false); setMotivo('')
    const desfazer = onRemover(cartaoId)
    iniciar(async () => {
      const r = await perderNegocio(cartaoId, m)
      if ('erro' in r) { desfazer(); onErro('Não foi possível marcar como perdido.') }
    })
  }

  return (
    <div className={estilos.menuWrap} ref={ref}>
      {}
      <button ref={gatilhoRef} type="button" className={estilos.kebab} aria-label="Ações"
        aria-expanded={aberto}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setAberto((v) => !v) }}
        disabled={pendente}>
        <MoreVertical size={16} />
      </button>
      {aberto && posicao && createPortal(
        
        
        <div className={estilos.menu} style={posicao} ref={menuRef}
          aria-label="Ações do negócio"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault() }}>
          {!modoPerder ? (
            <>
              <button type="button" className={estilos.menuItem} onClick={ganhar}>
                <Trophy size={15} /> Marcar como ganho
              </button>
              <button type="button" className={estilos.menuItem} onClick={() => setModoPerder(true)}>
                <XCircle size={15} /> Marcar como perdido
              </button>
              <button type="button" className={estilos.menuItem} onClick={duplicar}>
                <Copy size={15} /> Duplicar
              </button>
            </>
          ) : (
            <div className={estilos.perderBox}>
              {}
              <Entrada autoFocus className={estilos.quickInput} placeholder="Motivo da perda"
                value={motivo} onChange={(e) => setMotivo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') perder() }} />
              <Botao variante="primario" tom="erro" tamanho="pequeno" type="button" onClick={perder} desabilitado={!motivo.trim()}>Confirmar perda</Botao>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
