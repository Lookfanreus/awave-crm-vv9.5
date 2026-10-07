'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Plus, QrCode, RefreshCw, Trash2, Save } from 'lucide-react'
import {
  conectarCanal,
  conectarCanalCloud,
  contarConversasDoCanal,
  gerarQr,
  religarRecebimento,
  removerCanal,
  salvarAdminToken,
  salvarServerUrl,
  salvarUrlPublica,
} from '../acoes-canais'
import CanalInstagram from './CanalInstagram'
import {
  estadoDoCanal,
  fraseDeRejeitados,
  fraseDeRejeitadosPorAssinatura,
  fraseDeSegredoDeRecebimento,
  type TomDoSelo,
} from '@/lib/canais/estado-canal'
import {
  CONFIRMAR_EXCLUSAO_DO_CANAL,
  decisaoDoReligar,
  fraseDeExclusaoDoCanal,
} from '@/lib/canais/excluir-canal-copy'
import { formatarTamanho } from '@/lib/anexo'
import { copiarTexto, fraseDeFalhaAoCopiar, selecionarNaTela } from '@/lib/copiar'
import type { PainelDeCanais } from '@/server/canais/painel'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from '../config.module.css'
import local from './canais.module.css'


const MODIFICADOR: Record<TomDoSelo, string> = {
  ok: estilos.selo_ok,
  neutro: estilos.selo_neutro,
  alerta: estilos.selo_alerta,
  erro: estilos.selo_erro,
}


type Slot = 'url' | 'token' | 'canais' | 'exclusao'


type TipoDeCanal = 'pareado' | 'oficial' | 'instagram'

export default function CanaisWhatsApp({
  inicial,
  urlSugerida,
}: {
  inicial: PainelDeCanais
  
  urlSugerida: string
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<{ onde: Slot; texto: string } | null>(null)

  const [url, setUrl] = useState(inicial.urlPublica ?? urlSugerida)
  const [token, setToken] = useState('')
  const [nome, setNome] = useState('')
  const [servidor, setServidor] = useState('')
  
  const [servidores, setServidores] = useState<Record<string, string>>({})

  
  const [codigo, setCodigo] = useState<{ canalId: string; imagem: string | null } | null>(null)

  const [tipo, setTipo] = useState<TipoDeCanal>('pareado')
  const [nomeOficial, setNomeOficial] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  
  const [oficialCriado, setOficialCriado] = useState<{ url: string; verifyToken: string } | null>(
    null,
  )
  
  const [instagramCriado, setInstagramCriado] = useState<{
    url: string
    verifyToken: string
  } | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  
  const [semCopia, setSemCopia] = useState<{ marca: string; selecionou: boolean } | null>(null)

  
  const [excluindo, setExcluindo] = useState<{ canalId: string; conversas: number | null } | null>(
    null,
  )

  function rodar(
    acao: () => Promise<
      { ok: true } | { erro: string } | { ok: true; qr: string | null } | { ok: true; canalId: string }
    >,
    onde: Slot,
    
    depois?: () => void,
  ) {
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

  
  function pedirExclusao(canalId: string) {
    setErro(null)
    setCodigo(null)
    iniciar(async () => {
      let conversas: number | null = null
      try {
        const r = await contarConversasDoCanal(canalId)
        if ('conversas' in r) conversas = r.conversas
      } catch {
        
      }
      setExcluindo({ canalId, conversas })
    })
  }

  function pedirCodigo(canalId: string) {
    setErro(null)
    setCodigo(null)
    iniciar(async () => {
      const r = await gerarQr(canalId)
      if ('erro' in r) {
        setErro({ onde: 'canais', texto: r.erro })
        return
      }
      setCodigo({ canalId, imagem: r.qr })
      router.refresh()
    })
  }

  
  async function copiar(texto: string, marca: string, alvoId: string) {
    setSemCopia(null)
    if (await copiarTexto(texto, navigator.clipboard)) {
      setCopiado(marca)
      setTimeout(() => setCopiado((m) => (m === marca ? null : m)), 1500)
      return
    }
    
    
    setSemCopia({ marca, selecionou: selecionarNaTela(alvoId) })
  }

  
  function criarOficial() {
    setErro(null)
    setOficialCriado(null)
    iniciar(async () => {
      const r = await conectarCanalCloud({
        nome: nomeOficial,
        phoneNumberId,
        accessToken,
        appSecret,
        verifyToken,
      })
      if ('erro' in r) {
        setErro({ onde: 'canais', texto: r.erro })
        return
      }
      
      
      
      setOficialCriado({ url: r.urlDoWebhook, verifyToken: verifyToken.trim() })
      
      
      setNomeOficial('')
      setPhoneNumberId('')
      setAccessToken('')
      setAppSecret('')
      setVerifyToken('')
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

  const faltaUrl = !inicial.urlPublica
  
  const faltaToken = !inicial.temAdminToken
  const faltaTokenAqui = tipo === 'pareado' && faltaToken
  const podeCriar = inicial.ehDono && !faltaUrl && !faltaToken
  
  const podeCriarOficial = inicial.ehDono && !faltaUrl

  return (
    <>
      {}
      <section className={estilos.bloco}>
        <div className={estilos.blocoCab}>
          <h2 className={estilos.blocoTitulo}>Servidor de mensagens</h2>
          <span className={estilos.blocoMeta}>Vale para o servidor inteiro</span>
        </div>

        <p className={estilos.ajuda}>
          O WhatsApp entra no CRM por um servidor de mensagens que é da sua conta. Estas duas
          informações são pedidas uma vez, na instalação.
        </p>

        {}
        {!inicial.ehDono ? (
          <p className={estilos.vazio}>
            Só quem instalou este CRM pode alterar estas duas informações.
          </p>
        ) : (
          <>
            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor="url-publica">
                Endereço público deste CRM
              </label>
              <div className={estilos.linhaForm}>
                {}
                <Entrada
                  id="url-publica"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://crm.suaempresa.com.br"
                  readOnly={pendente}
                  aria-busy={pendente ? true : undefined}
                />
                {}
                <Botao
                  variante="primario"
                  type="button"
                  onClick={() =>
                    rodar(async () => {
                      const r = await salvarUrlPublica(url)
                      
                      
                      
                      
                      
                      
                      
                      
                      if (!('erro' in r)) setUrl(r.origem)
                      return r
                    }, 'url')
                  }
                  carregando={pendente}
                  desabilitado={!url.trim()}
                >
                  <Save size={16} strokeWidth={1.75} /> Salvar
                </Botao>
              </div>
              {slotErro('url')}
              <p className={estilos.ajuda}>
                É por aqui que o servidor de mensagens entrega o que seus clientes escrevem.
                Confira antes de salvar — sugerimos o endereço desta página.
              </p>
            </div>

            <div className={estilos.campo}>
              <label className={estilos.rotulo} htmlFor="admin-token">
                Token de administrador do servidor
              </label>
              <div className={estilos.linhaForm}>
                <Entrada
                  id="admin-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={inicial.temAdminToken ? 'Configurado — cole outro pra trocar' : 'Cole o token aqui'}
                  readOnly={pendente}
                  aria-busy={pendente ? true : undefined}
                />
                <Botao
                  variante="primario"
                  type="button"
                  onClick={() =>
                    rodar(async () => {
                      const r = await salvarAdminToken(token)
                      if (!('erro' in r)) setToken('')
                      return r
                    }, 'token')
                  }
                  carregando={pendente}
                  desabilitado={!token.trim()}
                >
                  <Save size={16} strokeWidth={1.75} /> Salvar
                </Botao>
              </div>
              {slotErro('token')}
              <p className={estilos.ajuda}>
                Ele fica guardado criptografado e nunca mais aparece nesta tela.
              </p>
            </div>
          </>
        )}
      </section>

      {}
      <section className={estilos.bloco}>
        <div className={estilos.blocoCab}>
          <h2 className={estilos.blocoTitulo}>Canais de WhatsApp</h2>
          <span className={estilos.blocoMeta}>Vale para este espaço de trabalho</span>
        </div>

        {slotErro('canais')}

        {inicial.ehDono && (faltaUrl || faltaTokenAqui) && (
          <p className={local.pendencia}>
            Antes de conectar um número, preencha{' '}
            {faltaUrl && faltaTokenAqui
              ? 'o endereço público e o token de administrador'
              : faltaUrl
                ? 'o endereço público deste CRM'
                : 'o token de administrador do servidor'}{' '}
            no bloco acima.
          </p>
        )}

        {inicial.ehDono && (
          <div className={estilos.campo}>
            <span className={estilos.rotulo}>Conectar um número</span>
            {}
            <div className={local.seletorTipo} role="group" aria-label="Tipo de canal">
              <button
                type="button"
                className={`${local.opcaoTipo} ${tipo === 'pareado' ? local.opcaoTipoAtiva : ''}`}
                onClick={() => setTipo('pareado')}
                aria-pressed={tipo === 'pareado'}
                disabled={pendente}
              >
                WhatsApp (código de pareamento)
              </button>
              <button
                type="button"
                className={`${local.opcaoTipo} ${tipo === 'oficial' ? local.opcaoTipoAtiva : ''}`}
                onClick={() => setTipo('oficial')}
                aria-pressed={tipo === 'oficial'}
                disabled={pendente}
              >
                WhatsApp oficial (Meta)
              </button>
              <button
                type="button"
                className={`${local.opcaoTipo} ${tipo === 'instagram' ? local.opcaoTipoAtiva : ''}`}
                onClick={() => setTipo('instagram')}
                aria-pressed={tipo === 'instagram'}
                disabled={pendente}
              >
                Instagram (Meta)
              </button>
            </div>
            {}
            {tipo === 'instagram' ? (
              <CanalInstagram
                podeCriar={podeCriarOficial}
                criado={instagramCriado}
                aoCriar={setInstagramCriado}
              />
            ) : tipo === 'pareado' ? (
              <>
                <div className={estilos.linhaForm}>
                  {}
                  <Entrada
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome do canal (ex.: Comercial)"
                    disabled={!podeCriar}
                    readOnly={pendente}
                    aria-busy={pendente ? true : undefined}
                    aria-label="Nome do canal"
                  />
                  <Entrada
                    value={servidor}
                    onChange={(e) => setServidor(e.target.value)}
                    placeholder="https://servidor-de-mensagens.exemplo.com"
                    disabled={!podeCriar}
                    readOnly={pendente}
                    aria-busy={pendente ? true : undefined}
                    aria-label="Endereço do servidor de mensagens"
                  />
                  <Botao
                    variante="primario"
                    type="button"
                    onClick={() => rodar(() => conectarCanal({ nome, serverUrl: servidor }), 'canais')}
                    carregando={pendente}
                    desabilitado={!podeCriar || !nome.trim() || !servidor.trim()}
                  >
                    <Plus size={16} strokeWidth={1.75} /> Conectar
                  </Botao>
                </div>
                <p className={estilos.ajuda}>
                  Isso cria uma instância na sua conta do servidor de mensagens. Ela é cobrada por
                  lá — conectar duas vezes cria duas.
                </p>
              </>
            ) : (
              <>
                {}
                {}
                <div className={local.pendencia}>
                  O canal oficial é da Meta, e ele cobra três coisas antes de funcionar:
                  <ol className={local.custoLista}>
                    <li>
                      criar um aplicativo no painel da Meta e passar pela revisão dela —{' '}
                      <strong>uma vez por espaço de trabalho</strong>;
                    </li>
                    <li>
                      <strong>
                        o número deixa de funcionar no aplicativo WhatsApp (e no WhatsApp
                        Business) do celular
                      </strong>
                      . Quem atende pelo aparelho perde isso, e voltar atrás não é um clique;
                    </li>
                    <li>
                      nesta versão o canal oficial <strong>recebe texto</strong>. Foto, áudio e
                      documento ficam para depois.
                    </li>
                  </ol>
                </div>

                <div className={estilos.campo}>
                  <label className={estilos.rotulo} htmlFor="cloud-nome">
                    Nome do canal
                  </label>
                  <Entrada
                    id="cloud-nome"
                    value={nomeOficial}
                    onChange={(e) => setNomeOficial(e.target.value)}
                    placeholder="Ex.: Comercial"
                    disabled={!podeCriarOficial}
                    readOnly={pendente}
                    aria-busy={pendente ? true : undefined}
                  />
                </div>

                <div className={estilos.campo}>
                  <label className={estilos.rotulo} htmlFor="cloud-phone-id">
                    Identificador do número (phone number ID)
                  </label>
                  <Entrada
                    id="cloud-phone-id"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="Só números, como aparece no painel da Meta"
                    disabled={!podeCriarOficial}
                    readOnly={pendente}
                    aria-busy={pendente ? true : undefined}
                  />
                  <p className={estilos.ajuda}>
                    Ele fica em WhatsApp → Configuração da API, ao lado do número. Não é o
                    telefone.
                  </p>
                </div>

                <div className={estilos.campo}>
                  <label className={estilos.rotulo} htmlFor="cloud-access-token">
                    Token de acesso
                  </label>
                  <Entrada
                    id="cloud-access-token"
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Cole o token inteiro"
                    disabled={!podeCriarOficial}
                    readOnly={pendente}
                    aria-busy={pendente ? true : undefined}
                  />
                </div>

                <div className={estilos.campo}>
                  <label className={estilos.rotulo} htmlFor="cloud-app-secret">
                    Chave de assinatura do aplicativo (App Secret)
                  </label>
                  <Entrada
                    id="cloud-app-secret"
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="Cole a chave inteira"
                    disabled={!podeCriarOficial}
                    readOnly={pendente}
                    aria-busy={pendente ? true : undefined}
                  />
                  <p className={estilos.ajuda}>
                    É com ela que conferimos se cada mensagem veio mesmo da Meta.
                  </p>
                </div>

                <div className={estilos.campo}>
                  <label className={estilos.rotulo} htmlFor="cloud-verify-token">
                    Token de verificação (você escolhe)
                  </label>
                  <Entrada
                    id="cloud-verify-token"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    placeholder="Invente uma senha longa e guarde-a"
                    disabled={!podeCriarOficial}
                    readOnly={pendente}
                    aria-busy={pendente ? true : undefined}
                  />
                  <p className={estilos.ajuda}>
                    A Meta pede este mesmo texto ao ligar o recebimento. Mostramos ele aqui
                    depois de criar o canal, para você colar lá.
                  </p>
                </div>

                <div className={estilos.linhaForm}>
                  <Botao
                    variante="primario"
                    type="button"
                    onClick={criarOficial}
                    carregando={pendente}
                    desabilitado={
                      !podeCriarOficial ||
                      !nomeOficial.trim() ||
                      !phoneNumberId.trim() ||
                      !accessToken.trim() ||
                      !appSecret.trim() ||
                      !verifyToken.trim()
                    }
                  >
                    <Plus size={16} strokeWidth={1.75} /> Criar canal oficial
                  </Botao>
                </div>

                {oficialCriado && (
                  <div className={estilos.segredoBloco}>
                    <p className={estilos.segredoAviso}>
                      Copie os dois agora — o endereço de recebimento <b>não é mostrado de novo</b>
                      , e não há como descobri-lo depois.
                    </p>
                    <div className={estilos.linhaCopiavel}>
                      <span className={estilos.segredoLabel}>url</span>
                      {}
                      <code className={estilos.valorMono} id="cloud-copia-url">
                        {oficialCriado.url}
                      </code>
                      {}
                      <Botao
                        tamanho="pequeno"
                        type="button"
                        onClick={() => copiar(oficialCriado.url, 'url', 'cloud-copia-url')}
                        aria-label="Copiar o endereço de recebimento"
                      >
                        {copiado === 'url' ? <Check size={14} /> : <Copy size={14} />}
                      </Botao>
                    </div>
                    {semCopia?.marca === 'url' ? (
                      <p className={estilos.erro} role="alert">
                        {fraseDeFalhaAoCopiar(semCopia.selecionou)}
                      </p>
                    ) : null}
                    <p className={local.ondeColar}>
                      Cole em WhatsApp → Configuração → Webhook, no campo <b>URL de callback</b>.
                    </p>
                    {}
                    <p className={local.ondeColar}>
                      Já tem outro número oficial aqui, no <b>mesmo aplicativo da Meta</b>? Então
                      não troque nada lá: deixe a URL de callback que já está colada. As
                      mensagens dos dois números chegam por ela, e o CRM entrega cada uma no
                      canal certo.
                    </p>
                    <div className={estilos.linhaCopiavel}>
                      <span className={estilos.segredoLabel}>token</span>
                      <code className={estilos.valorMono} id="cloud-copia-token">
                        {oficialCriado.verifyToken}
                      </code>
                      <Botao
                        tamanho="pequeno"
                        type="button"
                        onClick={() => copiar(oficialCriado.verifyToken, 'verify', 'cloud-copia-token')}
                        aria-label="Copiar o token de verificação"
                      >
                        {copiado === 'verify' ? <Check size={14} /> : <Copy size={14} />}
                      </Botao>
                    </div>
                    {semCopia?.marca === 'verify' ? (
                      <p className={estilos.erro} role="alert">
                        {fraseDeFalhaAoCopiar(semCopia.selecionou)}
                      </p>
                    ) : null}
                    <p className={local.ondeColar}>
                      Cole no campo <b>Token de verificação</b>, na mesma tela, e assine o evento{' '}
                      <b>messages</b>.
                    </p>
                    {}
                    <p className={estilos.segredoAviso}>
                      Trate esta URL como uma senha — quem a tiver consegue consumir o limite de
                      mensagens deste canal. Ela não vai em print de suporte nem em grupo de
                      WhatsApp.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <p className={estilos.rotuloSecao}>
          <span>Canais conectados</span>
          <span>{inicial.canais.length}</span>
        </p>

        {}
        {inicial.armazenamento &&
          (inicial.armazenamento.medido ? (
            <p className={estilos.ajuda}>
              Anexos guardados neste espaço de trabalho:{' '}
              {formatarTamanho(inicial.armazenamento.usadoBytes)} de{' '}
              {formatarTamanho(inicial.armazenamento.cotaBytes)}. Quando esse espaço acaba, as
              fotos, os áudios e os documentos que chegarem deixam de ser baixados — o texto das
              mensagens continua chegando normalmente.
            </p>
          ) : (
            <p className={estilos.ajuda}>
              Este espaço de trabalho tem arquivos demais para o CRM conferir de uma vez, então
              ele não sabe quanto do limite de {formatarTamanho(inicial.armazenamento.cotaBytes)}{' '}
              já está em uso — e, por segurança, trata o espaço como cheio: as fotos, os áudios e
              os documentos que chegarem deixam de ser baixados, e o texto das mensagens continua
              chegando normalmente. Para voltar a baixar, apague anexos antigos pelo painel do
              Supabase, em Storage.
            </p>
          ))}

        {inicial.canais.length === 0 ? (
          <p className={estilos.vazio}>
            Nenhum canal ainda — conecte um número pra começar a receber mensagens em Conversas.
          </p>
        ) : (
          <ul className={estilos.lista}>
            {inicial.canais.map((c) => {
              
              
              
              const e = estadoDoCanal(c.estado, c.conexaoPareada)
              
              
              
              
              const religar = decisaoDoReligar({ conexaoPareada: c.conexaoPareada, faltaUrl })
              
              
              
              
              
              
              
              
              
              
              const rejeitados = fraseDeRejeitados(c.eventosRejeitados, c.resolvePorIdentidade, {
                rejeitadoEm: c.rejeitadoEm,
                outroMotivo: c.eventosRejeitadosAssinatura,
                agoraMs: Date.now(),
              })
              
              
              
              
              
              
              
              
              
              
              
              const semSegredo = fraseDeSegredoDeRecebimento(c.temSegredoDeRecebimento, c.conexaoPareada)
              const porAssinatura = fraseDeRejeitadosPorAssinatura(c.eventosRejeitadosAssinatura, {
                rejeitadoEm: c.rejeitadoEm,
                outroMotivo: c.eventosRejeitados,
                agoraMs: Date.now(),
              })
              return (
                <li key={c.id} className={estilos.item}>
                  <div className={local.canalInfo}>
                    <span className={local.canalTopo}>
                      <span className={local.canalNome}>{c.nome}</span>
                      <span className={`${estilos.selo} ${MODIFICADOR[e.tom]}`}>{e.rotulo}</span>
                      {c.telefone && <code className={estilos.valorMono}>{c.telefone}</code>}
                    </span>
                    <span className={local.canalAjuda}>{e.ajuda}</span>
                    {rejeitados && <span className={local.canalAlerta}>{rejeitados}</span>}
                    {porAssinatura && <span className={local.canalAlerta}>{porAssinatura}</span>}
                    {}
                    {semSegredo && <span className={local.canalAlerta}>{semSegredo}</span>}
                    {}
                    {inicial.ehDono && c.conexaoPareada && (
                      <span className={estilos.linhaForm}>
                        <Entrada
                          value={servidores[c.id] ?? c.serverUrl}
                          onChange={(ev) =>
                            setServidores((s) => ({ ...s, [c.id]: ev.target.value }))
                          }
                          aria-label={`Endereço do servidor de ${c.nome}`}
                          readOnly={pendente}
                          aria-busy={pendente ? true : undefined}
                        />
                        <Botao
                          variante="primario"
                          type="button"
                          onClick={() =>
                            rodar(
                              () => salvarServerUrl(c.id, servidores[c.id] ?? c.serverUrl),
                              'canais',
                            )
                          }
                          carregando={pendente}
                          desabilitado={!(servidores[c.id] ?? c.serverUrl).trim()}
                        >
                          <Save size={16} strokeWidth={1.75} /> Salvar
                        </Botao>
                      </span>
                    )}
                  </div>

                  {}
                  <div className={estilos.acoes}>
                    {inicial.ehOwner && c.conexaoPareada && c.estado !== 'conectado' && (
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        type="button"
                        onClick={() => pedirCodigo(c.id)}
                        carregando={pendente}
                        aria-label={`Gerar código de pareamento de ${c.nome}`}
                      >
                        <QrCode size={14} strokeWidth={1.75} /> Gerar código
                      </Botao>
                    )}
                    {}
                    {inicial.ehDono && religar.aparece && (
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        type="button"
                        onClick={() => rodar(() => religarRecebimento(c.id), 'canais')}
                        carregando={pendente}
                        aria-label={`Religar o recebimento de ${c.nome}`}
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        desabilitado={!religar.funciona}
                      >
                        <RefreshCw size={14} strokeWidth={1.75} /> Religar recebimento
                      </Botao>
                    )}
                    {inicial.ehDono && (
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        tom="erro"
                        type="button"
                        onClick={() => pedirExclusao(c.id)}
                        carregando={pendente}
                        aria-label={`Excluir ${c.nome}`}
                      >
                        <Trash2 size={14} strokeWidth={1.75} /> Excluir
                      </Botao>
                    )}
                  </div>

                  {}
                  {excluindo?.canalId === c.id && (
                    <div className={estilos.confirmacao} aria-live="polite">
                      <p className={local.canalAlerta}>
                        {fraseDeExclusaoDoCanal(
                          { conversas: excluindo.conversas },
                          
                          
                          { conexaoPareada: c.conexaoPareada, faltaUrl },
                        )}
                      </p>
                      {}
                      <Botao
                        variante="primario"
                        tom="erro"
                        type="button"
                        carregando={pendente}
                        onClick={() =>
                          rodar(() => removerCanal(c.id), 'exclusao', () => setExcluindo(null))
                        }
                      >
                        <Trash2 size={14} strokeWidth={1.75} /> {CONFIRMAR_EXCLUSAO_DO_CANAL}
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
                  )}

                  {}
                  {codigo?.canalId === c.id && c.serverUrl !== '' && (
                    <div className={local.codigo}>
                      {codigo.imagem ? (
                        <img
                          className={local.codigoImagem}
                          src={codigo.imagem}
                          alt="Código de pareamento do WhatsApp"
                        />
                      ) : (
                        <p className={estilos.erro} role="alert">
                          O servidor de mensagens não devolveu um código. Tente de novo.
                        </p>
                      )}
                      <div className={local.codigoTexto}>
                        <span className={local.codigoDono}>
                          Você vai parear este aparelho com {c.serverUrl}. Se esse endereço não
                          é o seu, pare aqui.
                        </span>
                        <ol className={local.passosLeitura}>
                          <li>Abra o WhatsApp no celular do número deste canal.</li>
                          <li>Toque em Aparelhos conectados e depois em Conectar um aparelho.</li>
                          <li>Aponte a câmera para o código ao lado.</li>
                        </ol>
                        <span>O código vale por poucos segundos. Se expirar, gere outro.</span>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {}
        {inicial.ehDono && inicial.canais.length > 0 && (
          <p className={estilos.ajuda}>
            Se um canal aparece aqui, o aparelho está pareado e mesmo assim nada chega em
            Conversas, use <strong>Religar recebimento</strong>: ele avisa de novo o servidor
            de mensagens para onde entregar, sem criar outra instância cobrada.
          </p>
        )}
      </section>
    </>
  )
}
