'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada } from '@/components/ui/Campo'
import estilos from './auth.module.css'


export default function CampoSenha({
  id,
  name,
  rotulo,
  autoComplete,
  placeholder,
  minLength,
  required,
}: {
  id: string
  name: string
  rotulo: string
  autoComplete: 'current-password' | 'new-password'
  placeholder?: string
  minLength?: number
  required?: boolean
}) {
  const [visivel, setVisivel] = useState(false)
  const acao = visivel ? 'Ocultar senha' : 'Mostrar senha'

  return (
    <Campo id={id} rotulo={rotulo}>
      {}
      <div className={estilos.campoSenha}>
        <Entrada
          className={estilos.inputSenha}
          name={name}
          type={visivel ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        {}
        <Botao
          variante="fantasma"
          soIcone
          type="button"
          className={estilos.olho}
          onClick={() => setVisivel((v) => !v)}
          aria-label={acao}
          aria-pressed={visivel}
          title={acao}
        >
          {visivel ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
        </Botao>
      </div>
    </Campo>
  )
}
