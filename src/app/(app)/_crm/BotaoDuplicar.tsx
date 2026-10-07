'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { duplicarNegocio } from '@/server/crm/duplicar'
import Botao from '@/components/ui/Botao'
import estilos from './crm.module.css'


export default function BotaoDuplicar({ id }: { id: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function duplicar() {
    setErro(null)
    iniciar(async () => {
      const r = await duplicarNegocio({ id })
      if ('erro' in r) {
        setErro(
          r.erro === 'sem_workspace'
            ? 'Escolha um espaço de trabalho antes.'
            : 'Não consegui duplicar. Tente de novo.',
        )
        return
      }
      router.push(`/negocios/${r.id}`)
    })
  }

  return (
    <>
      <Botao type="button" carregando={pendente} onClick={duplicar}>
        <Copy size={14} />
        {pendente ? 'Duplicando…' : 'Duplicar'}
      </Botao>
      {erro ? <p className={estilos.erro} role="alert">{erro}</p> : null}
    </>
  )
}
