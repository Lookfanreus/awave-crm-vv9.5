'use client'
import { useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { temJanela24h } from '@/lib/canais/capacidades-cliente'
import { estadoDaJanela, nomeDaRede, textoDaJanela } from '@/lib/canais/janela24h'
import Botao from '@/components/ui/Botao'
import { AreaTexto } from '@/components/ui/Campo'
import estilos from '../conversas.module.css'


export default function Compositor({
  aoEnviar,
  rascunho,
  aoRascunhar,
  enviando,
  provider,
  ultimaEntradaIso,
  agoraMs,
}: {
  aoEnviar: (texto: string) => Promise<string | null>
  
  rascunho: string
  aoRascunhar: (texto: string) => void
  
  enviando: boolean
  provider: string
  ultimaEntradaIso: string | null
  agoraMs: number
}) {
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(): Promise<void> {
    const conteudo = rascunho.trim()
    
    
    if (!conteudo || enviando) return
    setErro(null)
    const falha = await aoEnviar(conteudo)
    if (falha) setErro(falha)
    
    
    
    
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>): void {
    
    
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void enviar()
    }
  }

  const janela = estadoDaJanela({
    temJanela: temJanela24h(provider),
    ultimaEntradaIso,
    agoraMs,
  })
  
  const rede = nomeDaRede(provider)

  return (
    <div className={estilos.compositor}>
      {}
      {janela.estado === 'fechada' ? (
        <p className={estilos.avisoJanela} role="status">
          {textoDaJanela('fechada', rede)}
        </p>
      ) : null}
      {janela.estado === 'aberta' ? (
        <p className={estilos.notaJanela}>{textoDaJanela('aberta', rede)}</p>
      ) : null}
      {erro ? (
        <p className={estilos.erroAcao} role="status">
          {erro}
        </p>
      ) : null}
      <div className={estilos.compositorLinha}>
        {}
        <AreaTexto
          className={estilos.campoResposta}
          value={rascunho}
          onChange={(e) => aoRascunhar(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder="Escreva a resposta e aperte Enter"
          aria-label="Resposta para o cliente"
          readOnly={enviando}
          aria-busy={enviando ? true : undefined}
        />
        {}
        <Botao
          type="button"
          variante="primario"
          onClick={() => void enviar()}
          carregando={enviando}
          desabilitado={rascunho.trim().length === 0}
        >
          <Send size={16} strokeWidth={2} />
          {}
          {enviando ? 'Enviando…' : 'Enviar'}
        </Botao>
      </div>
    </div>
  )
}
