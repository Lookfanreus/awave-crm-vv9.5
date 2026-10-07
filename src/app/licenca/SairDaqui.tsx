'use client'

import { useTransition } from 'react'
import { sairAction } from '@/server/auth/sair-action'
import base from '@/app/(auth)/auth.module.css'
import estilos from './licenca.module.css'


export default function SairDaqui() {
  const [pendente, iniciar] = useTransition()

  return (
    
    
    <div className={base.rodape}>
      Esta conta não é a dona deste servidor?{' '}
      <button
        type="button"
        className={`${base.link} ${estilos.sair}`}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            await sairAction()
            window.location.href = '/entrar'
          })
        }
      >
        {pendente ? 'Saindo…' : 'Sair'}
      </button>
    </div>
  )
}
