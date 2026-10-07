'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Power, PowerOff, Save } from 'lucide-react'
import {
  atribuirAssistente,
  definirAssistentePadrao,
  desligarAgente,
  editarAssistente,
  excluirAssistente,
  ligarAgente,
} from './acoes'




import {
  avisoDaExclusao,
  blocosDoAssistente,
  canaisDoAssistente,
  motivoDeNaoAlternar,
  motivoDeNaoExcluir,
  motivoDeNaoTrocarNumero,
  seloDoAgente,
} from '@/lib/agente/quem-responde'
import { TETO_NOME, TETO_SOBRE } from '@/lib/agente/tetos-persona'
import type { AssistenteNoPainel, CanalNoPainelDoAgente } from '@/server/agente/painel'
import Botao from '@/components/ui/Botao'
import Pill from '@/components/ui/Pill'
import { Campo, AreaTexto, Entrada, Selecao } from '@/components/ui/Campo'
import estilos from './agentes.module.css'

type Resultado = { ok: true } | { erro: string }


const AVISO_OPENAI =
  'Ao ligar, o conteúdo das conversas deste número é enviado para a OpenAI (Estados Unidos) ' +
  'para gerar as respostas. Isso inclui o que seus clientes escreverem.'


export default function CartaoDoAgente({
  agente,
  totalAssistentes,
  ehDono,
  temChave,
  canais,
  aberto,
  aoAlternarAberto,
}: {
  agente: AssistenteNoPainel
  
  totalAssistentes: number
  
  ehDono: boolean
  temChave: boolean
  
  canais: CanalNoPainelDoAgente[] | null
  aberto: boolean
  aoAlternarAberto: () => void
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  
  const [nomeInterno, setNomeInterno] = useState(agente.nomeInterno)
  const [nome, setNome] = useState(agente.nome)
  const [tratamento, setTratamento] = useState(agente.tratamento)
  const [sobre, setSobre] = useState(agente.sobreONegocio)

  function rodar(acao: () => Promise<Resultado>, aoDarCerto?: () => void) {
    setErro(null)
    iniciar(async () => {
      const r = await acao()
      if ('erro' in r) {
        setErro(r.erro)
        return
      }
      aoDarCerto?.()
      router.refresh()
    })
  }

  const motivoExcluir = motivoDeNaoExcluir(agente, totalAssistentes)
  const motivoTrocarNumero = motivoDeNaoTrocarNumero(agente)

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const canalPrincipalId = agente.canais && agente.canais.length > 0 ? agente.canais[0].id : ''
  const canalPrincipal = canais?.find((c) => c.id === canalPrincipalId) ?? null
  const motivoAlternar = canalPrincipal
    ? motivoDeNaoAlternar({ ehDono, temChave, ligado: canalPrincipal.ligado })
    : null

  
  
  
  
  const seloEstado = seloDoAgente(agente, canalPrincipal ? canalPrincipal.ligado : null)

  const rotuloAgente = agente.nomeInterno || 'Assistente sem nome'

  return (
    <article className={`${estilos.agente} ${aberto ? estilos.agenteAberto : ''}`}>
      <div className={estilos.linha}>
        <span className={estilos.agenteIcone} aria-hidden="true">
          <Bot size={17} strokeWidth={2} />
        </span>
        <div className={estilos.corpo}>
          <div className={estilos.tituloLinha}>
            <h2 className={estilos.tituloAgente}>{rotuloAgente}</h2>
            {agente.padrao ? <Pill variante="accent">Padrão</Pill> : null}
            {seloEstado ? <Pill variante={seloEstado.variante}>{seloEstado.texto}</Pill> : null}
          </div>
          <div className={estilos.meta}>
            <span>{canaisDoAssistente(agente)}</span>
            {}
            {agente.blocosVisiveis !== null ? (
              <>
                <span className={estilos.sep} aria-hidden="true">·</span>
                <span>{blocosDoAssistente(agente.blocosVisiveis)}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className={estilos.acoesLinha}>
          <Botao
            variante="fantasma"
            tamanho="pequeno"
            type="button"
            aria-expanded={aberto}
            aria-label={`${aberto ? 'Fechar' : 'Editar'} ${rotuloAgente}`}
            onClick={aoAlternarAberto}
          >
            {aberto ? 'Fechar' : 'Editar'}
          </Botao>
        </div>
      </div>

      {aberto ? (
        <div className={estilos.editor}>
          <h3 className={estilos.editorTitulo}>Como este agente fala</h3>

          <div className={estilos.campos}>
            <Campo rotulo="Como você chama este agente" ajuda="Só você vê — é o nome desta lista.">
              <Entrada
                maxLength={TETO_NOME}
                placeholder="Pós-venda"
                value={nomeInterno}
                onChange={(e) => setNomeInterno(e.target.value)}
              />
            </Campo>

            <Campo rotulo="Como ele se apresenta ao cliente">
              <Entrada
                maxLength={TETO_NOME}
                placeholder="Ana"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Campo>

            <Campo rotulo="Como ele fala com o cliente">
              <Selecao
                value={tratamento}
                onChange={(e) => setTratamento(e.target.value === 'senhor' ? 'senhor' : 'voce')}
              >
                <option value="voce">Você</option>
                <option value="senhor">Senhor(a)</option>
              </Selecao>
            </Campo>

            <Campo
              rotulo="O que sua empresa faz, em poucas linhas"
              className={estilos.campoLargo}
              ajuda={
                <>
                  Preço, prazo e política saem só do que estiver escrito na base de
                  conhecimento — o que não estiver lá, ele diz que não sabe.{' '}
                  <span className={sobre.length >= TETO_SOBRE ? estilos.contadorCheio : estilos.contador}>
                    {sobre.length} / {TETO_SOBRE}
                  </span>
                </>
              }
            >
              <AreaTexto
                maxLength={TETO_SOBRE}
                placeholder="Vendemos bolo caseiro por encomenda em Bauru. Entregamos de segunda a sábado."
                value={sobre}
                onChange={(e) => setSobre(e.target.value)}
              />
            </Campo>

            {}
            {}
            {canais && canais.length > 0 ? (
              <Campo
                rotulo="Onde ele atende"
                className={estilos.campoLargo}
                ajuda={motivoTrocarNumero ?? undefined}
              >
                {}
                <Selecao
                  disabled={pendente || motivoTrocarNumero !== null}
                  title={motivoTrocarNumero ?? undefined}
                  value={canalPrincipalId}
                  onChange={(e) => {
                    const escolhido = e.target.value
                    if (escolhido === canalPrincipalId) return
                    if (escolhido) rodar(() => atribuirAssistente(escolhido, agente.id))
                  }}
                >
                  <option value="">Nenhum número</option>
                  {canais.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome || 'Número sem nome'}
                    </option>
                  ))}
                </Selecao>
              </Campo>
            ) : (
              <div className={`${estilos.campo} ${estilos.campoLargo}`}>
                <span className={estilos.rotulo}>Onde ele atende</span>
                <p className={estilos.ajuda}>
                  {canais === null
                    ? 'Não consegui ler os números deste espaço de trabalho agora. Recarregue a página.'
                    : 'Nenhum canal conectado ainda. Conecte um em Configurações → Canais.'}
                </p>
              </div>
            )}
          </div>

          {canalPrincipal ? (
            <div className={estilos.blocoLigar}>
              <Botao
                variante="fantasma"
                tamanho="pequeno"
                type="button"
                carregando={pendente}
                desabilitado={motivoAlternar !== null}
                aria-label={`${canalPrincipal.ligado ? 'Desligar' : 'Ligar'} o agente em ${canalPrincipal.nome || 'número sem nome'}`}
                title={
                  motivoAlternar ??
                  (canalPrincipal.ligado ? 'Desligar o agente neste número' : 'Ligar o agente neste número')
                }
                onClick={() =>
                  rodar(() =>
                    canalPrincipal.ligado ? desligarAgente(canalPrincipal.id) : ligarAgente(canalPrincipal.id),
                  )
                }
              >
                {canalPrincipal.ligado ? (
                  <>
                    <PowerOff size={16} strokeWidth={1.75} /> Desligar
                  </>
                ) : (
                  <>
                    <Power size={16} strokeWidth={1.75} /> Ligar
                  </>
                )}
              </Botao>
              {motivoAlternar ? <p className={estilos.ajuda}>{motivoAlternar}</p> : null}
              <p className={estilos.avisoOpenAi}>{AVISO_OPENAI}</p>
            </div>
          ) : null}

          {erro ? (
            <p className={estilos.erro} role="alert">
              {erro}
            </p>
          ) : null}

          {excluindo ? (
            <div className={estilos.confirmacao}>
              <p className={estilos.ajuda}>
                {avisoDaExclusao(agente)} Isso não tem volta.
              </p>
              <div className={estilos.editorPe}>
                <Botao
                  variante="primario"
                  tom="erro"
                  type="button"
                  carregando={pendente}
                  onClick={() => rodar(() => excluirAssistente(agente.id), () => setExcluindo(false))}
                >
                  Excluir mesmo assim
                </Botao>
                <Botao type="button" carregando={pendente} onClick={() => setExcluindo(false)}>
                  Cancelar
                </Botao>
              </div>
            </div>
          ) : (
            <div className={estilos.editorPe}>
              <Botao
                variante="primario"
                type="button"
                carregando={pendente}
                desabilitado={!nomeInterno.trim()}
                onClick={() =>
                  rodar(() =>
                    editarAssistente({
                      id: agente.id,
                      nomeInterno,
                      nome,
                      tratamento,
                      sobreONegocio: sobre,
                    }),
                  )
                }
              >
                <Save size={16} strokeWidth={1.75} /> Salvar
              </Botao>
              {!agente.padrao ? (
                <Botao
                  variante="fantasma"
                  type="button"
                  carregando={pendente}
                  onClick={() => rodar(() => definirAssistentePadrao(agente.id))}
                >
                  Tornar padrão
                </Botao>
              ) : null}
              <span className={estilos.cresce} />
              <Botao
                variante="fantasma"
                tom="erro"
                type="button"
                carregando={pendente}
                desabilitado={motivoExcluir !== null}
                title={motivoExcluir ?? 'Excluir este agente'}
                aria-label={`Excluir ${rotuloAgente}`}
                onClick={() => setExcluindo(true)}
              >
                {}
                Excluir
              </Botao>
            </div>
          )}
          {motivoExcluir ? <p className={estilos.ajuda}>{motivoExcluir}</p> : null}
        </div>
      ) : null}
    </article>
  )
}
