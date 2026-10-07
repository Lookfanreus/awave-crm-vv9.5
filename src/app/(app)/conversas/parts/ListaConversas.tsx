'use client'
import { memo, useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import EstadoVazio from '@/components/ui/EstadoVazio'
import Botao from '@/components/ui/Botao'
import { Entrada, Selecao } from '@/components/ui/Campo'
import { marcadorDaConversa } from '@/lib/canais/assumir'
import { faixaDePaginacao } from '@/lib/canais/paginacao-inbox'
import { FILTROS, filtroValido, vazioDaLista, type FiltroDaInbox } from '@/lib/canais/filtro-inbox'
import { copyDoNome, situacaoDoNome } from '@/lib/canais/nome-do-perfil'
import type { ConversaLista } from '@/server/canais/leitura'
import estilos from '../conversas.module.css'


function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}


const CLASSE_DO_MARCADOR = {
  pessoa: 'marcadorPessoa',
  aparelho: 'marcadorAparelho',
  espera: 'marcadorEspera',
} as const

function ListaConversas({
  conversas,
  abertaId,
  aoAbrir,
  busca,
  aoBuscar,
  filtro,
  aoFiltrar,
  temMais,
  carregandoMais,
  erroMais,
  aoCarregarMais,
  mostrarFim,
  erroBusca,
}: {
  conversas: ConversaLista[]
  abertaId: string | null
  
  aoAbrir: (conversa: ConversaLista) => void
  busca: string
  aoBuscar: (valor: string) => void
  
  filtro: FiltroDaInbox
  aoFiltrar: (valor: FiltroDaInbox) => void
  
  temMais: boolean
  carregandoMais: boolean
  
  erroMais: string | null
  aoCarregarMais: () => void
  
  mostrarFim: boolean
  
  erroBusca: string | null
}) {
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  
  
  
  
  const faixa = faixaDePaginacao({
    podeCarregar: temMais,
    erro: erroMais,
    jaPediu: mostrarFim,
    vazia: conversas.length === 0,
  })

  
  
  
  const vazio = vazioDaLista({ filtro, busca })

  return (
    <>
      {}
      <Selecao
        className={estilos.filtroLista}
        value={filtro}
        onChange={(e) => aoFiltrar(filtroValido(e.target.value))}
        aria-label="Mostrar conversas"
      >
        {FILTROS.map((f) => (
          <option key={f.valor} value={f.valor}>
            {f.rotulo}
          </option>
        ))}
      </Selecao>

      {}
      <Entrada
        className={estilos.busca}
        type="search"
        value={busca}
        onChange={(e) => aoBuscar(e.target.value)}
        placeholder="Buscar pelo nome do contato"
        aria-label="Buscar conversa pelo nome do contato"
      />

      {}
      {erroBusca ? (
        <p className={`${estilos.erroAcao} ${estilos.erroBusca}`} role="alert">
          {erroBusca}
        </p>
      ) : null}

      {}
      {}
      {conversas.length === 0 && !erroBusca ? (
        <EstadoVazio
          icone={<MessageSquare size={20} strokeWidth={1.75} />}
          titulo={vazio.titulo}
          texto={vazio.texto}
        />
      ) : null}

      <ul className={estilos.lista}>
        {conversas.map((c) => {
          const marcador = marcadorDaConversa(c)
          
          
          
          
          
          
          
          
          const explicacao = copyDoNome(
            situacaoDoNome({
              perfilPendente: c.perfilPendente,
              
              
              nome: c.contatoNome,
              identidadeExterna: c.identidadeExterna,
            }),
          )
          return (
          <li key={c.id}>
            <button
              type="button"
              className={`${estilos.item} ${c.id === abertaId ? estilos.itemAtivo : ''}`}
              onClick={() => aoAbrir(c)}
              aria-current={c.id === abertaId ? 'true' : undefined}
            >
              <span className={estilos.linhaTexto}>
                {}
                <span className={estilos.nome}>{c.contatoNome ?? c.chaveExterna}</span>
                {}
                {marcador ? (
                  <span className={`${estilos.marcador} ${estilos[CLASSE_DO_MARCADOR[marcador.tipo]]}`}>
                    {marcador.texto}
                    {marcador.desde ? (
                      <time className={estilos.marcadorDesde} dateTime={marcador.desde}>
                        {montado ? ` · desde ${quando(marcador.desde)}` : ''}
                      </time>
                    ) : null}
                  </span>
                ) : null}
                {}
                {explicacao ? (
                  <span className={estilos.explicacaoNome}>{explicacao}</span>
                ) : null}
              </span>
              {}
              {c.naoLidas > 0 ? (
                <span className={estilos.naoLidas} title={`${c.naoLidas} sem ler`}>
                  {c.naoLidas}
                </span>
              ) : c.ultimaMensagemEm ? (
                <time className={estilos.quando} dateTime={c.ultimaMensagemEm}>
                  {montado ? quando(c.ultimaMensagemEm) : ''}
                </time>
              ) : null}
            </button>
          </li>
          )
        })}
      </ul>

      {}
      {faixa.controle || faixa.erro || faixa.fim ? (
        <div className={estilos.rodapeLista}>
          {faixa.erro ? (
            <p className={estilos.erroAcao} role="alert">
              {faixa.erro}
            </p>
          ) : null}
          {faixa.controle ? (
            <Botao type="button" onClick={aoCarregarMais} carregando={carregandoMais}>
              {carregandoMais ? 'Carregando…' : 'Carregar mais conversas'}
            </Botao>
          ) : null}
          {faixa.fim ? (
            <p className={estilos.fimDaLista}>
              Fim da lista — não há mais conversas para carregar.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}


export default memo(ListaConversas)
