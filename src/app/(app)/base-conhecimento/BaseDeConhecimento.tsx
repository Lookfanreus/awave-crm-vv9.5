'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Power, PowerOff, RefreshCw, Save, Trash2, X } from 'lucide-react'
import {
  alternarEntrada,
  excluirEntrada,
  reprocessarPendentes,
  salvarEntrada,
  salvarRecorteDoBloco,
  type RecorteDoBloco,
} from './acoes'


import {
  fraseDeExclusaoDaEntrada,
  TETO_CONTEUDO,
  TETO_REPROCESSO_POR_CLIQUE,
  TETO_TITULO,
} from '@/lib/canais/base-conhecimento'
import { hrefDaAba } from '@/lib/agentes-abas'



import { motivoDeNaoAlternar } from '@/lib/agente/quem-responde'
import type { EntradaListada } from '@/server/crm/base-conhecimento'
import Botao from '@/components/ui/Botao'
import { AreaTexto, Entrada } from '@/components/ui/Campo'
import estilos from '../config/config.module.css'
import local from './base.module.css'


const FOLGA_DE_AVISO = 200

type Slot = 'form' | 'lista' | 'pendentes' | 'exclusao'


type AssistenteDoRecorte = { id: string; nomeInterno: string }

export default function BaseDeConhecimento({
  entradas,
  semVetor,
  temChave,
  ehDono,
  ehOwner,
  assistentes,
}: {
  entradas: EntradaListada[]
  semVetor: number
  temChave: boolean
  
  ehDono: boolean
  ehOwner: boolean
  assistentes: AssistenteDoRecorte[]
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<{ onde: Slot; texto: string } | null>(null)

  const [id, setId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [tipo, setTipo] = useState<'fato' | 'playbook'>('fato')
  
  
  
  const [recorteModo, setRecorteModo] = useState<'todos' | 'so_estes'>('todos')
  const [recorteSelecionados, setRecorteSelecionados] = useState<string[]>([])
  
  
  
  
  
  const [recorteConhecido, setRecorteConhecido] = useState(true)

  
  const [excluindo, setExcluindo] = useState<string | null>(null)

  
  const formRef = useRef<HTMLElement>(null)

  function limparForm() {
    setId(null)
    setTitulo('')
    setConteudo('')
    setTipo('fato')
    setRecorteModo('todos')
    setRecorteSelecionados([])
    setRecorteConhecido(true)
  }

  
  function editarEntrada(e: EntradaListada) {
    setId(e.id)
    setTitulo(e.titulo)
    setConteudo(e.conteudo)
    setTipo(e.tipo)
    
    
    
    
    if (e.assistentes === null) {
      setRecorteConhecido(false)
      setRecorteModo('todos')
      setRecorteSelecionados([])
    } else {
      setRecorteConhecido(true)
      
      
      setRecorteModo(e.assistentes.length > 0 ? 'so_estes' : 'todos')
      setRecorteSelecionados(e.assistentes)
    }
    formRef.current?.scrollIntoView({ block: 'start' })
    formRef.current?.querySelector<HTMLInputElement>('#titulo-entrada')?.focus({ preventScroll: true })
  }

  function rodar(acao: () => Promise<{ ok: true } | { erro: string }>, onde: Slot, depois?: () => void) {
    setErro(null)
    iniciar(async () => {
      const r = await acao()
      if ('erro' in r) {
        setErro({ onde, texto: r.erro })
        return
      }
      depois?.()
      router.refresh()
    })
  }

  
  function salvar() {
    setErro(null)
    const criando = id === null
    iniciar(async () => {
      const r = await salvarEntrada({ id: id ?? undefined, titulo, conteudo, tipo })
      if ('erro' in r) {
        setErro({ onde: 'form', texto: r.erro })
        
        
        
        
        
        
        router.refresh()
        return
      }
      setId(r.id)
      const precisaGravarRecorte =
        assistentes.length > 1 && recorteConhecido && !(criando && recorteModo === 'todos')
      if (precisaGravarRecorte) {
        const recorte: RecorteDoBloco =
          recorteModo === 'todos' ? { modo: 'todos' } : { modo: 'so_estes', ids: recorteSelecionados }
        const rRecorte = await salvarRecorteDoBloco(r.id, recorte)
        if ('erro' in rRecorte) {
          setErro({ onde: 'form', texto: rRecorte.erro })
          
          
          router.refresh()
          return
        }
      }
      limparForm()
      router.refresh()
    })
  }

  
  
  function slotErro(onde: Slot) {
    return erro?.onde === onde ? (
      <p className={estilos.erro} role="alert">
        {erro.texto}
      </p>
    ) : null
  }

  function contador(valor: string, teto: number) {
    const estado =
      valor.length >= teto ? local.contadorCheio : valor.length >= teto - FOLGA_DE_AVISO ? local.contadorAviso : ''
    return (
      <span className={`${local.contador} ${estado}`}>
        {valor.length} / {teto}
      </span>
    )
  }

  return (
    <>
      {}

      {}
      {!temChave ? (
        <p className={local.faixaNeutra}>
          <strong>Sem a chave de IA o assistente não responde nada</strong> — ele nem chega a
          rodar, aqui ou em qualquer conversa. O que você escrever nesta tela fica guardado e
          passa a valer assim que a chave for configurada.{' '}
          {}
          {ehDono ? (
            <>
              Cole-a em{' '}
              <Link href={hrefDaAba('servidor')} className={local.link}>
                Agentes de IA → Servidor
              </Link>
              .{' '}
            </>
          ) : (
            <>
              {motivoDeNaoAlternar({ ehDono, temChave, ligado: false })}
              {' '}
            </>
          )}
          É a mesma chave para responder e para encontrar por semelhança.
        </p>
      ) : semVetor > 0 ? (
        <div className={local.faixaNeutra}>
          <p className={local.faixaTexto}>
            {semVetor === 1
              ? '1 entrada ainda não entrou na busca por semelhança'
              : `${semVetor} entradas ainda não entraram na busca por semelhança`}{' '}
            — elas continuam sendo encontradas por texto.
          </p>
          {ehOwner ? (
            <Botao
              variante="primario"
              type="button"
              carregando={pendente}
              onClick={() => rodar(() => reprocessarPendentes(), 'pendentes')}
            >
              <RefreshCw size={16} strokeWidth={1.75} /> Tentar de novo (até{' '}
              {TETO_REPROCESSO_POR_CLIQUE} por vez)
            </Botao>
          ) : null}
        </div>
      ) : null}
      {slotErro('pendentes')}

      {}
      {ehOwner ? (
        <section className={estilos.bloco} ref={formRef}>
          <div className={estilos.blocoCab}>
            <h2 className={estilos.blocoTitulo}>{id ? 'Editando uma entrada' : 'Escrever uma entrada'}</h2>
            <span className={estilos.blocoMeta}>Vale para este espaço de trabalho</span>
          </div>

          <div className={estilos.campo}>
            <span className={estilos.rotulo}>Que tipo de informação é esta</span>
            <div className={estilos.linhaForm}>
              <label className={estilos.ajuda} htmlFor="tipo-fato">
                <input
                  id="tipo-fato"
                  type="radio"
                  name="tipo"
                  checked={tipo === 'fato'}
                  onChange={() => setTipo('fato')}
                />{' '}
                um fato (preço, prazo, horário)
              </label>
              <label className={estilos.ajuda} htmlFor="tipo-playbook">
                <input
                  id="tipo-playbook"
                  type="radio"
                  name="tipo"
                  checked={tipo === 'playbook'}
                  onChange={() => setTipo('playbook')}
                />{' '}
                como responder (política, roteiro)
              </label>
            </div>
          </div>

          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor="titulo-entrada">
              Sobre o que é
            </label>
            <Entrada
              id="titulo-entrada"
              maxLength={TETO_TITULO}
              placeholder="Preço do bolo de 1kg"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            {contador(titulo, TETO_TITULO)}
          </div>

          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor="conteudo-entrada">
              O que o assistente pode responder
            </label>
            <AreaTexto
              id="conteudo-entrada"
              maxLength={TETO_CONTEUDO}
              placeholder="O bolo de 1kg custa R$ 80. O de 2kg, R$ 140. Entregamos em Bauru sem custo."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
            />
            {contador(conteudo, TETO_CONTEUDO)}
            <p className={estilos.ajuda}>
              Escreva como você responderia ao cliente. O assistente usa este texto como está —
              ele não completa o que falta e não estima o que não estiver escrito.
            </p>
          </div>

          {}
          {assistentes.length > 1 ? (
            <div className={estilos.campo}>
              <span className={estilos.rotulo}>Quem pode usar esta informação</span>
              <div className={estilos.linhaForm}>
                <label className={estilos.ajuda} htmlFor="recorte-todos">
                  <input
                    id="recorte-todos"
                    type="radio"
                    name="recorte"
                    disabled={!recorteConhecido}
                    checked={recorteConhecido && recorteModo === 'todos'}
                    onChange={() => setRecorteModo('todos')}
                  />{' '}
                  todos os assistentes
                </label>
                <label className={estilos.ajuda} htmlFor="recorte-so-estes">
                  <input
                    id="recorte-so-estes"
                    type="radio"
                    name="recorte"
                    disabled={!recorteConhecido}
                    checked={recorteConhecido && recorteModo === 'so_estes'}
                    onChange={() => setRecorteModo('so_estes')}
                  />{' '}
                  só estes
                </label>
              </div>
              {recorteConhecido && recorteModo === 'so_estes' ? (
                <div className={estilos.linhaForm}>
                  {assistentes.map((a) => (
                    <label key={a.id} className={estilos.ajuda} htmlFor={`recorte-${a.id}`}>
                      <input
                        id={`recorte-${a.id}`}
                        type="checkbox"
                        checked={recorteSelecionados.includes(a.id)}
                        onChange={(e) =>
                          setRecorteSelecionados((atual) =>
                            e.target.checked ? [...atual, a.id] : atual.filter((sel) => sel !== a.id),
                          )
                        }
                      />{' '}
                      {a.nomeInterno || 'Assistente sem nome'}
                    </label>
                  ))}
                </div>
              ) : null}
              {}
              {recorteConhecido && recorteModo === 'so_estes' && recorteSelecionados.length === 0 ? (
                <p className={estilos.ajuda}>
                  Escolha pelo menos um assistente para salvar — ou volte para
                  &quot;todos os assistentes&quot;.
                </p>
              ) : null}
              {recorteConhecido ? (
                <p className={estilos.ajuda}>
                  Por padrão, todo assistente enxerga tudo o que está escrito aqui. Restrinja só se
                  este fato não deve valer para todos — uma política de um assistente que não é a
                  de outro, por exemplo.
                </p>
              ) : (
                <p className={estilos.ajuda}>
                  Não deu para ler agora quem já pode usar esta entrada. Salvar não vai mexer
                  nisso — recarregue a página para tentar de novo.
                </p>
              )}
            </div>
          ) : null}

          <div className={estilos.acoes}>
            {}
            <Botao
              variante="primario"
              type="button"
              carregando={pendente}
              desabilitado={
                !titulo.trim() ||
                !conteudo.trim() ||
                (assistentes.length > 1 &&
                  recorteConhecido &&
                  recorteModo === 'so_estes' &&
                  recorteSelecionados.length === 0)
              }
              onClick={salvar}
            >
              <Save size={16} strokeWidth={1.75} /> {id ? 'Salvar alteração' : 'Salvar'}
            </Botao>
            {id ? (
              <Botao type="button" carregando={pendente} onClick={limparForm}>
                <X size={16} strokeWidth={1.75} /> Cancelar
              </Botao>
            ) : null}
          </div>
          {slotErro('form')}
        </section>
      ) : null}

      {}
      <section className={estilos.bloco}>
        <div className={estilos.blocoCab}>
          <h2 className={estilos.blocoTitulo}>O que já está escrito</h2>
          <span className={estilos.blocoMeta}>
            {entradas.length === 1 ? '1 entrada' : `${entradas.length} entradas`}
          </span>
        </div>

        {!ehOwner ? (
          <p className={estilos.ajuda}>
            Só quem administra este espaço de trabalho pode escrever, editar ou apagar o que o
            assistente sabe.
          </p>
        ) : null}

        {entradas.length === 0 ? (
          <p className={estilos.vazio}>
            Nada escrito ainda. Enquanto esta lista estiver vazia, o assistente responde dúvidas
            gerais e diz que alguém do time responde preço, prazo e política.
          </p>
        ) : (
          <ul className={estilos.lista}>
            {entradas.map((e) => (
              <li key={e.id} className={estilos.item}>
                <div className={estilos.itemInfo}>
                  <span className={estilos.itemRotulo}>{e.titulo}</span>
                  <span className={local.trecho}>{e.conteudo}</span>
                  <span className={local.selos}>
                    <span className={`${estilos.selo} ${estilos.selo_neutro}`}>
                      {e.tipo === 'playbook' ? 'como responder' : 'fato'}
                    </span>
                    {}
                    {e.origem === 'aprendizado' ? (
                      <span className={`${estilos.selo} ${estilos.selo_alerta}`}>proposta</span>
                    ) : null}
                    {!e.habilitado ? (
                      <span className={`${estilos.selo} ${estilos.selo_neutro}`}>desligada</span>
                    ) : null}
                    {}
                    {!e.temVetor ? (
                      <span className={`${estilos.selo} ${estilos.selo_neutro}`}>só por texto</span>
                    ) : null}
                    {}
                    {id === e.id ? (
                      <span className={`${estilos.selo} ${estilos.selo_alerta}`}>editando</span>
                    ) : null}
                  </span>
                </div>
                {}
                {ehOwner ? (
                  <>
                    <div className={estilos.acoes}>
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        type="button"
                        carregando={pendente}
                        aria-label={`Editar ${e.titulo}`}
                        onClick={() => editarEntrada(e)}
                      >
                        Editar
                      </Botao>
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        type="button"
                        carregando={pendente}
                        aria-label={`${e.habilitado ? 'Desligar' : 'Ligar'} ${e.titulo}`}
                        onClick={() => rodar(() => alternarEntrada(e.id, !e.habilitado), 'lista')}
                      >
                        {e.habilitado ? (
                          <>
                            <PowerOff size={16} strokeWidth={1.75} /> Desligar
                          </>
                        ) : (
                          <>
                            <Power size={16} strokeWidth={1.75} /> Ligar
                          </>
                        )}
                      </Botao>
                      {}
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        tom="erro"
                        type="button"
                        carregando={pendente}
                        aria-label={`Excluir ${e.titulo}`}
                        onClick={() => setExcluindo(e.id)}
                      >
                        <Trash2 size={16} strokeWidth={1.75} /> Excluir
                      </Botao>
                    </div>

                    {}
                    {excluindo === e.id ? (
                      <div className={estilos.confirmacao} aria-live="polite">
                        <p className={estilos.ajuda}>{fraseDeExclusaoDaEntrada(e.habilitado)}</p>
                        <Botao
                          variante="primario"
                          tom="erro"
                          type="button"
                          carregando={pendente}
                          onClick={() =>
                            rodar(() => excluirEntrada(e.id), 'exclusao', () => {
                              setExcluindo(null)
                              if (id === e.id) limparForm()
                            })
                          }
                        >
                          Excluir mesmo assim
                        </Botao>
                        <Botao
                          type="button"
                          carregando={pendente}
                          onClick={() => {
                            setExcluindo(null)
                            setErro(null)
                          }}
                        >
                          Cancelar
                        </Botao>
                        {}
                        {slotErro('exclusao')}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {}
        <p className={estilos.ajuda}>
          Desligada, a entrada some das respostas e continua escrita aqui. Excluir apaga de vez.
        </p>
        {slotErro('lista')}
      </section>
    </>
  )
}
