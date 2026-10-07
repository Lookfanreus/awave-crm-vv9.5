'use client'

import { mensagemGate } from '@/lib/mensagem-gate'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, XCircle } from 'lucide-react'
import { ganharNegocio, perderNegocio } from '@/app/(app)/negocios/actions'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './crm.module.css'


export default function BotoesGanharPerder({ negocioId }: { negocioId: string }) {
  const router = useRouter()
  const [modoPerder, setModoPerder] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function ganhar() {
    setErro(null)
    iniciar(async () => {
      const r = await ganharNegocio(negocioId)
      if ('erro' in r) {
        setErro(mensagemGate(r.erro, r.campos, 'Não foi possível marcar como ganho. Tente novamente.'))
      } else {
        router.refresh()
      }
    })
  }

  function perder() {
    const m = motivo.trim()
    if (!m) return
    setErro(null)
    iniciar(async () => {
      const r = await perderNegocio(negocioId, m)
      if ('erro' in r) {
        setErro('Não foi possível marcar como perdido. Tente novamente.')
      } else {
        setModoPerder(false)
        setMotivo('')
        router.refresh()
      }
    })
  }

  return (
    <div>
      <div className={estilos.ganharPerderWrap}>
        <Botao type="button" tom="ok" onClick={ganhar} carregando={pendente}>
          <Trophy size={14} />
          Ganhar
        </Botao>
        {!modoPerder ? (
          <Botao
            type="button"
            tom="erro"
            onClick={() => { setModoPerder(true); setErro(null) }}
            carregando={pendente}
          >
            <XCircle size={14} />
            Perder
          </Botao>
        ) : (
          <div className={estilos.motivoWrap}>
            <div className={estilos.motivoRow}>
              <Entrada
                autoFocus
                className={estilos.motivo}
                placeholder="Motivo da perda"
                aria-label="Motivo da perda"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={pendente}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') perder()
                  if (e.key === 'Escape') { setModoPerder(false); setMotivo('') }
                }}
              />
              <Botao
                type="button"
                tom="erro"
                onClick={perder}
                carregando={pendente}
                desabilitado={!motivo.trim()}
              >
                Confirmar
              </Botao>
              <Botao
                type="button"
                onClick={() => { setModoPerder(false); setMotivo('') }}
                carregando={pendente}
              >
                Cancelar
              </Botao>
            </div>
          </div>
        )}
      </div>
      {erro && <p className={`${estilos.erro} ${estilos.erroInline}`}>{erro}</p>}
    </div>
  )
}
