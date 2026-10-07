'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { fraseDoEfeito, type AlvoExclusao, type ContagemEfeito } from '@/lib/excluir-copy'
import Botao from '@/components/ui/Botao'
import estilos from './crm.module.css'


export default function BotaoExcluir({
  alvo,
  id,
  rotulo,
  aoExcluir,
  contar,
  redirecionarPara,
}: {
  alvo: AlvoExclusao
  id: string
  
  rotulo: string
  
  aoExcluir: (input: { id: string }) => Promise<{ ok: true } | { erro: string }>
  
  contar?: (id: string) => Promise<ContagemEfeito>
  
  redirecionarPara?: string
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [contagem, setContagem] = useState<ContagemEfeito>({})
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function abrir() {
    setErro(null)
    iniciar(async () => {
      
      
      
      if (contar) {
        try {
          setContagem(await contar(id))
        } catch {
          setContagem({})
        }
      }
      setConfirmando(true)
    })
  }

  function excluir() {
    setErro(null)
    iniciar(async () => {
      const r = await aoExcluir({ id })
      if ('erro' in r) {
        setErro(
          r.erro === 'sem_workspace'
            ? 'Escolha um espaço de trabalho antes.'
            : 'Não consegui excluir. Tente de novo.',
        )
        return
      }
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      if (redirecionarPara) window.location.assign(redirecionarPara)
      else router.refresh()
    })
  }

  if (!confirmando) {
    return (
      <div className={estilos.excluirWrap}>
        <Botao type="button" variante="fantasma" tom="erro" carregando={pendente} onClick={abrir}>
          <Trash2 size={14} strokeWidth={1.75} />
          {rotulo}
        </Botao>
        {erro ? <p className={estilos.erro} role="alert">{erro}</p> : null}
      </div>
    )
  }

  return (
    <div className={estilos.excluirWrap}>
      <div className={estilos.confirmaExcluir} role="alertdialog" aria-live="polite">
        <p className={estilos.confirmaTexto}>{fraseDoEfeito(alvo, contagem)}</p>
        <div className={estilos.confirmaAcoes}>
          <Botao type="button" variante="primario" tom="erro" carregando={pendente} onClick={excluir}>
            {pendente ? 'Excluindo…' : 'Excluir mesmo assim'}
          </Botao>
          <Botao
            type="button"
            carregando={pendente}
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </Botao>
        </div>
        {erro ? <p className={estilos.erro} role="alert">{erro}</p> : null}
      </div>
    </div>
  )
}
