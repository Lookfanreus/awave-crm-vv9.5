'use client'
import { memo, useLayoutEffect, useRef } from 'react'
import Botao from '@/components/ui/Botao'
import { legendaAExibir } from '@/lib/canais/legenda'
import { faixaDePaginacao } from '@/lib/canais/paginacao-inbox'



import { estaNoFim, rolagemDoCommit, type MarcaDoCommit } from '@/lib/canais/rolagem-thread'


import { AUTOR_DA_NOTA, formaDaLinha } from '@/lib/canais/status-da-mensagem'
import type { MensagemThread } from '@/server/canais/leitura'
import estilos from '../conversas.module.css'


const AUTOR: Record<MensagemThread['autor'], string> = {
  contato: 'Cliente',
  membro: 'Equipe',
  aparelho: 'Aparelho',
  agente: 'IA',
}


function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Midia({ midia, url }: { midia: NonNullable<MensagemThread['midia']>; url?: string | null }) {
  if (midia.status === 'pendente') return <p className={estilos.midiaNota}>Baixando o arquivo…</p>
  if (midia.status === 'erro') return <p className={estilos.midiaNota}>Não foi possível baixar o arquivo</p>
  
  
  if (!url) return <p className={estilos.midiaNota}>{midia.kind}</p>
  if (midia.kind === 'imagem') {
    
    
    
    return <img className={estilos.midiaImagem} src={url} alt={midia.legenda ?? 'Imagem recebida'} />
  }
  return (
    <p className={estilos.midiaNota}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        Abrir {midia.kind}
      </a>
    </p>
  )
}


function Thread({
  mensagens,
  conversaId,
  acrescimosNoTopo,
  temAnteriores,
  carregandoAnteriores,
  erroAnteriores,
  aoVerAnteriores,
  mostrarInicio,
}: {
  mensagens: MensagemThread[]
  
  conversaId: string
  
  acrescimosNoTopo: number
  
  temAnteriores: boolean
  carregandoAnteriores: boolean
  erroAnteriores: string | null
  aoVerAnteriores: () => void
  
  mostrarInicio: boolean
}) {
  
  
  const faixa = faixaDePaginacao({
    podeCarregar: temAnteriores,
    erro: erroAnteriores,
    jaPediu: mostrarInicio,
    vazia: mensagens.length === 0,
  })

  const areaRef = useRef<HTMLDivElement | null>(null)
  
  const antesRef = useRef({ alturaTotal: 0, noFim: true })
  
  const vistoRef = useRef<MarcaDoCommit | null>(null)

  function medir(el: HTMLDivElement) {
    return { topo: el.scrollTop, alturaVisivel: el.clientHeight, alturaTotal: el.scrollHeight }
  }

  function anotar(el: HTMLDivElement): void {
    antesRef.current = { alturaTotal: el.scrollHeight, noFim: estaNoFim(medir(el)) }
  }

  useLayoutEffect(() => {
    const el = areaRef.current
    if (el === null) return
    const agora = { conversaId, acrescimosNoTopo }
    
    
    
    
    
    const alvo = rolagemDoCommit({
      visto: vistoRef.current,
      agora,
      
      
      estavaNoFim: antesRef.current.noFim,
      medida: medir(el),
      alturaAntes: antesRef.current.alturaTotal,
    })
    
    
    vistoRef.current = agora
    
    if (alvo !== null) el.scrollTop = alvo
    anotar(el)
    
    
    
  }, [mensagens, conversaId, acrescimosNoTopo])

  return (
    <div
      className={estilos.threadRolagem}
      ref={areaRef}
      onScroll={() => {
        const el = areaRef.current
        if (el !== null) anotar(el)
      }}
    >
      {}
      {faixa.controle || faixa.erro || faixa.fim ? (
        <div className={estilos.topoDaThread}>
          {}
          {faixa.erro ? (
            <p className={estilos.erroAcao} role="alert">
              {faixa.erro}
            </p>
          ) : null}
          {faixa.controle ? (
            <Botao
              type="button"
              tamanho="pequeno"
              onClick={aoVerAnteriores}
              carregando={carregandoAnteriores}
            >
              {carregandoAnteriores ? 'Carregando…' : 'Ver mensagens anteriores'}
            </Botao>
          ) : null}
          {faixa.fim ? <p className={estilos.inicioDaConversa}>Início da conversa.</p> : null}
        </div>
      ) : null}

      <ul className={estilos.thread}>
      {mensagens.map((m) => {
        
        
        const legenda = legendaAExibir(m.texto, m.midia?.legenda)
        const saida = m.direcao === 'saida'
        const forma = formaDaLinha(m.status)
        
        
        
        
        
        
        
        
        if (forma.forma === 'nota') {
          return (
            <li key={m.id} className={estilos.notaDoSistema}>
              <p className={estilos.notaDoSistemaMeta}>
                {AUTOR_DA_NOTA} · <time dateTime={m.origemEm}>{hora(m.origemEm)}</time>
              </p>
              <p className={estilos.notaDoSistemaTexto}>{m.texto}</p>
            </li>
          )
        }
        return (
          <li key={m.id} className={`${estilos.msg} ${saida ? estilos.msgSaida : estilos.msgEntrada}`}>
            <p className={`${estilos.msgMeta} ${m.status === 'falhou' ? estilos.msgFalhou : ''}`}>
              {AUTOR[m.autor]} · <time dateTime={m.origemEm}>{hora(m.origemEm)}</time>
              {}
              {saida && forma.forma === 'rotulo' ? ` · ${forma.texto}` : null}
            </p>
            {}
            {saida && m.ultimoErro ? <p className={estilos.msgErro}>{m.ultimoErro}</p> : null}
            <div className={saida ? estilos.balaoSaida : estilos.balao}>
              {m.midia ? <Midia midia={m.midia} url={m.midiaUrl} /> : null}
              {}
              {m.texto ? <p className={estilos.texto}>{m.texto}</p> : null}
              {legenda ? <p className={estilos.legenda}>{legenda}</p> : null}
            </div>
          </li>
        )
      })}
      </ul>
    </div>
  )
}


export default memo(Thread)
