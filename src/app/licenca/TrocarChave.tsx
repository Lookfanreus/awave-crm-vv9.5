'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { salvarChaveDeLicenca } from '@/app/(app)/config/acoes-licenca'
import { copyDoErroDeChave } from '@/lib/licenca-copy'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada } from '@/components/ui/Campo'
import base from '@/app/(auth)/auth.module.css'
import estilos from './licenca.module.css'


export default function TrocarChave() {
  const [chave, setChave] = useState('')
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  
  
  
  
  const [salvouSemDestravar, setSalvouSemDestravar] = useState(false)
  const router = useRouter()

  function enviar() {
    iniciar(async () => {
      setErro(null)
      setSalvouSemDestravar(false)
      const r = await salvarChaveDeLicenca(chave)
      if ('erro' in r) {
        setErro(copyDoErroDeChave(r.erro))
        return
      }
      
      
      setChave('')
      setSalvouSemDestravar(true)
      
      
      
      
      router.refresh()
    })
  }

  return (
    <form
      className={estilos.secao}
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
    >
      <Campo
        id="chave-nova"
        rotulo="Trocar a chave de licença"
        
        ajuda="Colou a chave errada? Cole a correta aqui. Ela é gravada e conferida com o Hub na hora. Salvar não libera o acesso por conta própria — quem decide é a resposta que o Hub der."
        erro={erro}
      >
        <Entrada
          type="text"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          
          
          
          placeholder="Colar a chave da licença…"
          
          autoComplete="off"
          spellCheck={false}
          disabled={pendente}
        />
      </Campo>

      <Botao
        variante="primario"
        larguraTotal
        type="submit"
        className={base.enviar}
        
        
        
        
        carregando={pendente}
        desabilitado={!chave.trim()}
      >
        {pendente ? 'Salvando…' : 'Salvar e conferir'}
      </Botao>
      {salvouSemDestravar && (
        <p className={base.aviso}>
          Chave salva. O Hub ainda não confirmou o acesso — se o servidor tem acesso à
          internet, tente novamente em alguns minutos.
        </p>
      )}
    </form>
  )
}
