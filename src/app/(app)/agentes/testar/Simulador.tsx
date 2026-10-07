'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eraser, Send } from 'lucide-react'
import { limpar, simular, type MotivoDaSimulacao } from './acoes'
import { TETO_TEXTO_SIMULADO } from '@/lib/canais/simulacao'
import Botao from '@/components/ui/Botao'
import { AreaTexto } from '@/components/ui/Campo'
import { ROTULO_ABA } from '@/lib/agentes-abas'
import estilos from '../agentes.module.css'
import local from './simulador.module.css'


type Bolha = {
  id: string
  autor: 'contato' | 'membro' | 'aparelho' | 'agente'
  texto: string
}


const GENERICO = 'Alguma coisa ficou fora do lugar nesta conversa de teste. Comece uma nova pelo botão de limpar.'

const COPY: Record<MotivoDaSimulacao, string | null> = {
  
  sem_chave: `O assistente não tem a chave da conta de inteligência artificial. Cole a chave na aba ${ROTULO_ABA.servidor} de "Agentes de IA" e tente de novo.`,
  teto_simulacao:
    'Você chegou ao limite de testes desta hora. Ele existe para o teste não gastar a conta que responde aos seus clientes — espere um pouco e continue.',
  teto_conversa:
    'Esta conversa de teste já teve respostas demais na última hora. Limpe e comece outra, ou espere um pouco.',
  teto_workspace:
    'Este espaço de trabalho chegou ao limite de respostas da hora — contando as dos seus clientes de verdade, não só as de teste.',
  teto_deploy:
    'O servidor chegou ao limite de respostas da hora, somando todos os espaços de trabalho. Espere um pouco.',
  fora_da_janela:
    'A última mensagem é antiga demais para o assistente responder. Limpe e comece uma conversa nova.',

  
  
  
  pediu_humano:
    'Você pediu para falar com uma pessoa, e o assistente parou de responder nesta conversa — como faria com um cliente de verdade. Isso não tem volta: limpe para testar de novo.',

  
  
  humano_com_a_conversa: null,

  
  sem_conversa: GENERICO,
  sem_canal: GENERICO,
  workspace_divergente: GENERICO,

  
  
  
  
  
  
  
  
  
  
  
  
  
  agente_desligado: `O canal de teste está desligado. Ele nasce ligado e o painel não o lista na aba ${ROTULO_ABA.agentes} de "Agentes de IA", então não dá para acendê-lo por lá — fale com quem instalou o CRM.`,

  
  job_velho: GENERICO,
  ninguem_perguntou: null,
  nao_rodou: `O assistente não respondeu desta vez. Tente de novo; se continuar, confira a chave e o modelo na aba ${ROTULO_ABA.servidor} de "Agentes de IA".`,
}

function mensagemDaRecusa(motivo: MotivoDaSimulacao, canalLigado: boolean): string | null {
  
  
  
  if (motivo === 'agente_desligado' && canalLigado) return null
  return COPY[motivo]
}


type AssistenteDoSeletor = { id: string; nomeInterno: string; padrao: boolean }

export default function Simulador({
  fio,
  temChave,
  ehOwner,
  canalLigado,
  assistentes,
}: {
  fio: Bolha[]
  temChave: boolean
  ehOwner: boolean
  canalLigado: boolean
  assistentes: AssistenteDoSeletor[]
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [recusa, setRecusa] = useState<string | null>(null)
  
  
  
  
  const [escolhido, setEscolhido] = useState(assistentes.find((a) => a.padrao)?.id ?? '')

  function enviar() {
    const conteudo = texto.trim()
    if (!conteudo) return
    setErro(null)
    setRecusa(null)
    iniciar(async () => {
      const r = await simular(conteudo, escolhido || null)
      if ('erro' in r) {
        setErro(r.erro)
        return
      }
      setTexto('')
      setRecusa(r.motivo ? mensagemDaRecusa(r.motivo, canalLigado) : null)
      router.refresh()
    })
  }

  function limparFio() {
    setErro(null)
    setRecusa(null)
    iniciar(async () => {
      const r = await limpar()
      if ('erro' in r) {
        setErro(r.erro)
        return
      }
      setTexto('')
      router.refresh()
    })
  }

  return (
    <>
      <section className={estilos.bloco}>
        <div className={estilos.blocoCab}>
          <h2 className={estilos.blocoTitulo}>A conversa de teste</h2>
          <span className={estilos.blocoMeta}>Vale para este espaço de trabalho</span>
        </div>

        {}
        {}
        <p className={estilos.ajuda}>
          Isto testa <strong>o que o assistente responde</strong>, com a mesma personalidade e a
          mesma base de conhecimento que ele usa com clientes. Ele não testa se o seu WhatsApp
          está conectado, se o número entrega, nem se o assistente está ligado para os seus
          clientes — a conexão você confere em Configurações → Canais, e quem responde em cada
          número, na aba {ROTULO_ABA.agentes}{' '}
          de &quot;Agentes de IA&quot;.
        </p>

        {!ehOwner ? (
          <p className={estilos.vazio}>
            Só quem administra este espaço de trabalho pode testar o assistente.
          </p>
        ) : (
          <>
            {!temChave ? (
              <p className={local.faixaNeutra}>
                Falta a chave da conta de inteligência artificial. Sem ela o assistente não
                responde — nem aqui, nem para os seus clientes.
              </p>
            ) : null}

            {}
            {assistentes.length > 1 ? (
              <div className={estilos.campo}>
                <label className={estilos.rotulo} htmlFor="assistente-do-teste">
                  Testar com qual assistente
                </label>
                {}
                <select
                  id="assistente-do-teste"
                  value={escolhido}
                  disabled={pendente}
                  onChange={(e) => setEscolhido(e.target.value)}
                >
                  {assistentes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nomeInterno || 'Assistente sem nome'}
                      {a.padrao ? ' (padrão)' : ''}
                    </option>
                  ))}
                </select>
                <p className={estilos.ajuda}>
                  Vale só para este teste — não muda quem responde nos seus números.
                </p>
              </div>
            ) : null}

            {fio.length === 0 ? (
              <p className={estilos.vazio}>
                Nenhuma mensagem ainda. Escreva abaixo como se fosse um cliente.
              </p>
            ) : (
              <ol className={local.fio}>
                {fio.map((b) => (
                  <li
                    key={b.id}
                    className={`${local.bolha} ${b.autor === 'agente' ? local.bolhaAgente : local.bolhaCliente}`}
                  >
                    <span className={local.quem}>
                      {b.autor === 'agente' ? 'Assistente' : 'Você, como cliente'}
                    </span>
                    <p className={local.texto}>{b.texto}</p>
                  </li>
                ))}
              </ol>
            )}

            {}
            {pendente ? (
              <p className={local.esperando} aria-live="polite">
                O assistente está pensando…
              </p>
            ) : null}

            {recusa ? (
              <p className={local.faixaNeutra} aria-live="polite">
                {recusa}
              </p>
            ) : null}

            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor="texto-simulado">
                A mensagem do cliente
              </label>
              {}
              <AreaTexto
                id="texto-simulado"
                maxLength={TETO_TEXTO_SIMULADO}
                placeholder="Oi, vocês entregam em Bauru? Quanto custa?"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                readOnly={pendente}
                aria-busy={pendente ? true : undefined}
              />
            </div>

            <div className={local.acoes}>
              {}
              <Botao
                variante="primario"
                type="button"
                carregando={pendente}
                desabilitado={!texto.trim()}
                onClick={enviar}
              >
                <Send size={16} strokeWidth={1.75} /> Enviar
              </Botao>
              {}
              <Botao
                type="button"
                carregando={pendente}
                desabilitado={fio.length === 0}
                onClick={limparFio}
              >
                <Eraser size={16} strokeWidth={1.75} /> Limpar e recomeçar
              </Botao>
            </div>

            {erro ? (
              <p className={estilos.erro} role="alert">
                {erro}
              </p>
            ) : null}
          </>
        )}
      </section>
    </>
  )
}
