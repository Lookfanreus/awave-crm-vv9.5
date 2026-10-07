'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { revalidarAgora } from '@/app/(app)/config/acoes-licenca'
import Botao from '@/components/ui/Botao'
import base from '@/app/(auth)/auth.module.css'


export default function AcoesLicenca() {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  
  
  
  
  
  
  
  
  
  
  const [naoConfirmou, setNaoConfirmou] = useState(false)
  const router = useRouter()

  return (
    <div className={base.acao}>
      <Botao
        variante="primario"
        larguraTotal
        type="button"
        className={base.enviar}
        
        
        carregando={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null)
            setNaoConfirmou(false)
            const r = await revalidarAgora()
            if ('erro' in r) {
              
              
              
              setErro('Não deu para verificar agora. Tente de novo em alguns instantes.')
              return
            }
            setNaoConfirmou(true)
            
            
            
            
            
            
            
            
            router.refresh()
          })
        }
      >
        {pendente ? 'Verificando…' : 'Verificar agora'}
      </Botao>
      {erro && <p className={base.erro}>{erro}</p>}
      {}
      {naoConfirmou && (
        <p className={base.aviso}>
          Verificamos agora e o Hub ainda não confirmou. Se o servidor tem acesso à internet,
          tente de novo em alguns minutos.
        </p>
      )}
    </div>
  )
}
