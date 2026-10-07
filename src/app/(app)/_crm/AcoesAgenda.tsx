'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CalendarClock } from 'lucide-react'
import { concluirAtividade, reagendarAtividade } from '@/server/crm/agenda-acoes'
import { paraDatetimeLocal, deDatetimeLocal } from '@/lib/formato'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './acoesAgenda.module.css'


export default function AcoesAgenda({ id, vencimento }: { id: string; vencimento: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [reagendando, setReagendando] = useState(false)
  const [novo, setNovo] = useState(() => paraDatetimeLocal(vencimento))

  function concluir() {
    iniciar(async () => { await concluirAtividade(id); router.refresh() })
  }
  function salvar() {
    if (!novo) return
    iniciar(async () => { await reagendarAtividade(id, deDatetimeLocal(novo)); setReagendando(false); router.refresh() })
  }

  if (reagendando) {
    return (
      <div className={estilos.acoes}>
        <Entrada
          type="datetime-local"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          disabled={pendente}
          aria-label="Nova data e hora"
        />
        <Botao type="button" variante="primario" tamanho="pequeno" onClick={salvar} carregando={pendente} desabilitado={!novo}>Salvar</Botao>
        <Botao type="button" tamanho="pequeno" onClick={() => setReagendando(false)} carregando={pendente}>Cancelar</Botao>
      </div>
    )
  }

  return (
    <div className={estilos.acoes}>
      <Botao type="button" tom="ok" tamanho="pequeno" onClick={concluir} carregando={pendente}>
        <Check size={14} /> Concluir
      </Botao>
      <Botao type="button" tamanho="pequeno" soIcone onClick={() => setReagendando(true)} carregando={pendente} title="Reagendar" aria-label="Reagendar">
        <CalendarClock size={14} />
      </Botao>
    </div>
  )
}
