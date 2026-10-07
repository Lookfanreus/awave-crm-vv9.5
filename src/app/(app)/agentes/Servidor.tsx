'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { salvarChaveOpenAI, salvarModelo } from './acoes'
import type { PainelDoAgente } from '@/server/agente/painel'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada } from '@/components/ui/Campo'
import estilos from './agentes.module.css'


export default function Servidor({ inicial }: { inicial: PainelDoAgente }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  
  const [aviso, setAviso] = useState<string | null>(null)

  
  
  
  const [chave, setChave] = useState('')
  const [modelo, setModelo] = useState(inicial.modelo)

  function rodar(acao: () => Promise<{ ok: true; aviso?: string } | { erro: string }>) {
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const r = await acao()
      if ('erro' in r) {
        setErro(r.erro)
        return
      }
      if (r.aviso) setAviso(r.aviso)
      router.refresh()
    })
  }

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>A conta que paga as respostas</h2>
        <span className={estilos.blocoMeta}>Vale para o servidor inteiro</span>
      </div>

      <p className={estilos.ajuda}>
        O assistente usa uma conta de inteligência artificial que é sua, e cobra por uso. Sem
        ela, o CRM continua funcionando normalmente — só o assistente não responde.
      </p>

      {!inicial.ehDono ? (
        <p className={estilos.vazio}>
          Só quem instalou este CRM pode configurar e ligar o assistente.
        </p>
      ) : (
        <>
          {}
          <Campo rotulo={`Chave da sua conta ${inicial.temChave ? '(já configurada)' : '(faltando)'}`}>
            <div className={estilos.linhaForm}>
              <Entrada
                type="password"
                autoComplete="off"
                placeholder={inicial.temChave ? '••••••••  cole aqui para trocar' : 'cole a chave aqui'}
                value={chave}
                onChange={(e) => setChave(e.target.value)}
              />
              <Botao
                variante="primario"
                type="button"
                carregando={pendente}
                desabilitado={!chave.trim()}
                onClick={() => rodar(() => salvarChaveOpenAI(chave))}
              >
                <Save size={16} strokeWidth={1.75} /> Salvar
              </Botao>
            </div>
          </Campo>
          <p className={estilos.ajuda}>
            Ela entra e não sai: por segurança, esta tela nunca mostra a chave de volta.
          </p>

          <Campo rotulo={`Modelo ${inicial.modeloEhPadrao ? '(usando o padrão)' : ''}`}>
            <div className={estilos.linhaForm}>
              <Entrada value={modelo} onChange={(e) => setModelo(e.target.value)} />
              <Botao
                variante="primario"
                type="button"
                carregando={pendente}
                desabilitado={!modelo.trim()}
                onClick={() => rodar(() => salvarModelo(modelo))}
              >
                <Save size={16} strokeWidth={1.75} /> Salvar
              </Botao>
            </div>
          </Campo>
          <p className={estilos.ajuda}>
            Só mexa aqui se o assistente parar de responder e a mensagem de erro disser que o
            modelo não existe — isso acontece quando o fornecedor aposenta um modelo antigo.
          </p>

          {}
          {aviso ? (
            <p className={estilos.ajuda} role="status">
              {aviso}
            </p>
          ) : null}
          {erro ? (
            <p className={estilos.erro} role="alert">
              {erro}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
