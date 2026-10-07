'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bot, ChevronRight, MessagesSquare, Plus, Save } from 'lucide-react'
import { criarAssistente } from './acoes'




import { fraseDeResponderPorFora } from '@/lib/agente/quem-responde'
import { chaveDaPersona } from '@/lib/agente/chave-da-persona'
import { TETO_NOME, TETO_SOBRE } from '@/lib/agente/tetos-persona'
import type { PainelDoAgente } from '@/server/agente/painel'
import Botao from '@/components/ui/Botao'
import EstadoVazio from '@/components/ui/EstadoVazio'
import { AreaTexto, Campo, Entrada, Selecao } from '@/components/ui/Campo'
import CartaoDoAgente from './CartaoDoAgente'
import NumerosDoEspaco from './NumerosDoEspaco'
import estilos from './agentes.module.css'


type RascunhoNovo = {
  nomeInterno: string
  nome: string
  tratamento: 'voce' | 'senhor'
  sobreONegocio: string
}

const RASCUNHO_NOVO: RascunhoNovo = {
  nomeInterno: '',
  nome: '',
  tratamento: 'voce',
  sobreONegocio: '',
}


export default function ListaDeAgentes({ inicial }: { inicial: PainelDoAgente }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [criando, setCriando] = useState(false)
  const [rascunho, setRascunho] = useState(RASCUNHO_NOVO)
  const [erroNovo, setErroNovo] = useState<string | null>(null)
  
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const assistentes = inicial.assistentes

  
  const porFora = fraseDeResponderPorFora(inicial.canais)

  function abrirCriacao() {
    setErroNovo(null)
    setRascunho(RASCUNHO_NOVO)
    setCriando(true)
  }

  function fecharCriacao() {
    setCriando(false)
    setRascunho(RASCUNHO_NOVO)
    setErroNovo(null)
  }

  function salvarNovo() {
    setErroNovo(null)
    iniciar(async () => {
      const r = await criarAssistente(rascunho)
      if ('erro' in r) {
        setErroNovo(r.erro)
        return
      }
      fecharCriacao()
      router.refresh()
    })
  }

  return (
    <>
      {}
      {assistentes.length > 0 && !criando ? (
        <div className={estilos.cabecalhoLista}>
          <Botao variante="primario" type="button" onClick={abrirCriacao}>
            <Plus size={16} strokeWidth={1.75} /> Novo agente
          </Botao>
        </div>
      ) : null}

      {}
      {assistentes.length === 0 && !criando ? (
        <EstadoVazio
          icone={<Bot size={20} strokeWidth={1.75} />}
          titulo="Nenhum agente ainda"
          texto="Crie o primeiro e escreva como ele fala — ele nasce como o padrão deste espaço de trabalho, e passa a responder assim que você o ligar num número."
          acao={
            <Botao variante="primario" type="button" onClick={abrirCriacao}>
              <Plus size={16} strokeWidth={1.75} /> Criar o primeiro agente
            </Botao>
          }
        />
      ) : null}

      {criando ? (
        <div className={estilos.painelNovo}>
          <h3 className={estilos.editorTitulo}>Novo agente</h3>

          <div className={estilos.campos}>
            <Campo rotulo="Como você chama este agente" ajuda="Só você vê — é o nome desta lista.">
              <Entrada
                maxLength={TETO_NOME}
                placeholder="Pós-venda"
                value={rascunho.nomeInterno}
                onChange={(e) => setRascunho({ ...rascunho, nomeInterno: e.target.value })}
              />
            </Campo>

            <Campo rotulo="Como ele se apresenta ao cliente">
              <Entrada
                maxLength={TETO_NOME}
                placeholder="Ana"
                value={rascunho.nome}
                onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
              />
            </Campo>

            <Campo rotulo="Como ele fala com o cliente">
              <Selecao
                value={rascunho.tratamento}
                onChange={(e) =>
                  setRascunho({ ...rascunho, tratamento: e.target.value === 'senhor' ? 'senhor' : 'voce' })
                }
              >
                <option value="voce">Você</option>
                <option value="senhor">Senhor(a)</option>
              </Selecao>
            </Campo>

            <Campo
              rotulo="O que sua empresa faz, em poucas linhas"
              className={estilos.campoLargo}
              ajuda={
                <span
                  className={
                    rascunho.sobreONegocio.length >= TETO_SOBRE ? estilos.contadorCheio : estilos.contador
                  }
                >
                  {rascunho.sobreONegocio.length} / {TETO_SOBRE}
                </span>
              }
            >
              <AreaTexto
                maxLength={TETO_SOBRE}
                placeholder="Vendemos bolo caseiro por encomenda em Bauru. Entregamos de segunda a sábado."
                value={rascunho.sobreONegocio}
                onChange={(e) => setRascunho({ ...rascunho, sobreONegocio: e.target.value })}
              />
            </Campo>
          </div>

          {erroNovo ? (
            <p className={estilos.erro} role="alert">
              {erroNovo}
            </p>
          ) : null}

          <div className={estilos.editorPe}>
            <Botao
              variante="primario"
              type="button"
              carregando={pendente}
              desabilitado={!rascunho.nomeInterno.trim()}
              onClick={salvarNovo}
            >
              <Save size={16} strokeWidth={1.75} /> Salvar
            </Botao>
            <Botao type="button" carregando={pendente} onClick={fecharCriacao}>
              Cancelar
            </Botao>
          </div>
        </div>
      ) : null}

      {assistentes.length > 0 ? (
        <div className={estilos.lista}>
          {assistentes.map((a) => (
            <CartaoDoAgente
              
              
              
              
              key={chaveDaPersona(a.id, a)}
              agente={a}
              totalAssistentes={assistentes.length}
              ehDono={inicial.ehDono}
              temChave={inicial.temChave}
              canais={inicial.canais}
              aberto={abertoId === a.id}
              aoAlternarAberto={() => setAbertoId((atual) => (atual === a.id ? null : a.id))}
            />
          ))}
        </div>
      ) : null}

      {}
      <NumerosDoEspaco
        canais={inicial.canais}
        assistentes={assistentes}
        ehDono={inicial.ehDono}
        temChave={inicial.temChave}
      />

      {}
      <p className={estilos.tesoura}>
        Precisa calar o assistente numa conversa específica? Abra a conversa na caixa de entrada
        e escolha uma pessoa em <strong>Assumir</strong>: o assistente para de responder ali até
        alguém clicar em <strong>Devolver ao assistente</strong>.{' '}
        {porFora ? (
          <>
            {porFora}
            {' '}
          </>
        ) : null}
        Ele ainda para sozinho quando o próprio cliente pede para falar com alguém do time.
      </p>

      {}
      <div className={estilos.destinos}>
        <Link href="/agentes/testar" className={estilos.destino}>
          <span className={estilos.destinoIcone}>
            <MessagesSquare size={16} strokeWidth={1.75} />
          </span>
          <span className={estilos.destinoTexto}>
            <span className={estilos.destinoNome}>Testar o assistente</span>
            <span className={estilos.destinoSub}>
              Escreva como se fosse um cliente e veja o que ele responde, sem precisar de
              WhatsApp conectado. Nenhuma mensagem é enviada para ninguém.
            </span>
          </span>
          <ChevronRight size={16} strokeWidth={1.75} className={estilos.destinoSeta} />
        </Link>
      </div>
    </>
  )
}
