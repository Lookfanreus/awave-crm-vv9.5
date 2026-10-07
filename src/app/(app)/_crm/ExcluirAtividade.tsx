'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { excluirAtividade } from '@/server/crm/excluir'
import { fraseDoEfeito } from '@/lib/excluir-copy'
import Botao from '@/components/ui/Botao'
import estilos from './crm.module.css'


export default function ExcluirAtividade({ id }: { id: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function excluir() {
    setErro(null)
    iniciar(async () => {
      const r = await excluirAtividade({ id })
      if ('erro' in r) {
        setErro('Não consegui excluir.')
        return
      }
      
      router.refresh()
    })
  }

  if (!confirmando) {
    return (
      <Botao
        type="button"
        variante="fantasma"
        tom="erro"
        soIcone
        tamanho="pequeno"
        carregando={pendente}
        onClick={() => setConfirmando(true)}
        title="Excluir atividade"
        aria-label="Excluir atividade"
      >
        <Trash2 size={13} strokeWidth={1.75} />
      </Botao>
    )
  }

  return (
    <span className={estilos.confirmaItem} role="alertdialog">
      <span className={estilos.confirmaItemTexto}>{fraseDoEfeito('atividade')}</span>
      <Botao type="button" variante="primario" tom="erro" tamanho="pequeno" carregando={pendente} onClick={excluir}>
        {pendente ? 'Excluindo…' : 'Excluir'}
      </Botao>
      <Botao
        type="button"
        tamanho="pequeno"
        carregando={pendente}
        onClick={() => setConfirmando(false)}
      >
        Cancelar
      </Botao>
      {erro ? <span className={estilos.erro} role="alert">{erro}</span> : null}
    </span>
  )
}
