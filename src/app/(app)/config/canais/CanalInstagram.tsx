'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Plus } from 'lucide-react'
import { conectarCanalInstagram } from '../acoes-canais'
import { copiarTexto, fraseDeFalhaAoCopiar, selecionarNaTela } from '@/lib/copiar'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from '../config.module.css'
import local from './canais.module.css'


export default function CanalInstagram({
  podeCriar,
  criado,
  aoCriar,
}: {
  podeCriar: boolean
  
  criado: { url: string; verifyToken: string } | null
  
  aoCriar: (v: { url: string; verifyToken: string } | null) => void
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [contaId, setContaId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [verifyToken, setVerifyToken] = useState('')

  const [copiado, setCopiado] = useState<string | null>(null)
  
  const [semCopia, setSemCopia] = useState<{ marca: string; selecionou: boolean } | null>(null)

  
  async function copiar(texto: string, marca: string, alvoId: string) {
    setSemCopia(null)
    if (await copiarTexto(texto, navigator.clipboard)) {
      setCopiado(marca)
      setTimeout(() => setCopiado((m) => (m === marca ? null : m)), 1500)
      return
    }
    
    
    setSemCopia({ marca, selecionou: selecionarNaTela(alvoId) })
  }

  function criar() {
    setErro(null)
    aoCriar(null)
    iniciar(async () => {
      const r = await conectarCanalInstagram({ nome, contaId, accessToken, appSecret, verifyToken })
      if ('erro' in r) {
        setErro(r.erro)
        return
      }
      
      
      
      aoCriar({ url: r.urlDoWebhook, verifyToken: verifyToken.trim() })
      
      
      setNome('')
      setContaId('')
      setAccessToken('')
      setAppSecret('')
      setVerifyToken('')
      router.refresh()
    })
  }

  return (
    <>
      {erro ? (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      ) : null}

      {}
      {}
      <div className={local.pendencia}>
        O canal do Instagram é da Meta, e ele cobra quatro coisas antes de funcionar:
        <ol className={local.custoLista}>
          <li>
            a permissão do aplicativo é <strong>outra</strong> (mensagens do Instagram), e ela
            passa pela revisão da Meta — mesmo que você já use o WhatsApp oficial;
          </li>
          <li>
            <strong>
              a conta precisa ser Profissional e estar ligada a uma Página do Facebook
            </strong>
            , e as mensagens precisam estar liberadas para outros aplicativos nas configurações
            do Instagram;
          </li>
          <li>
            nesta versão o canal <strong>recebe e envia texto</strong>. Foto, áudio, figurinha e
            resposta a story ficam para depois;
          </li>
          <li>
            <strong>mensagem enviada fica como &quot;enviada&quot;</strong> e não avança para
            entregue nem lida: este canal não confirma entrega mensagem a mensagem.
          </li>
        </ol>
        A boa notícia: o <strong>aplicativo da Meta pode ser o mesmo</strong> de quem já ativou o
        WhatsApp oficial — a chave de assinatura é a mesma.
      </div>

      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="ig-nome">
          Nome do canal
        </label>
        {}
        <Entrada
          id="ig-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Instagram da loja"
          disabled={!podeCriar}
          readOnly={pendente}
          aria-busy={pendente ? true : undefined}
        />
      </div>

      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="ig-conta-id">
          Identificador da conta do Instagram (Instagram account ID)
        </label>
        <Entrada
          id="ig-conta-id"
          value={contaId}
          onChange={(e) => setContaId(e.target.value)}
          placeholder="Só números, como aparece no painel da Meta"
          disabled={!podeCriar}
          readOnly={pendente}
          aria-busy={pendente ? true : undefined}
        />
        {}
        <p className={estilos.ajuda}>
          Ele fica em Instagram → Configuração da API, ao lado da conta. Não é o @ do perfil, e
          não é o identificador da Página do Facebook — se você colar um deles, as mensagens
          chegam e são recusadas, sem entrar em Conversas.
        </p>
      </div>

      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="ig-access-token">
          Token de acesso
        </label>
        <Entrada
          id="ig-access-token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Cole o token inteiro"
          disabled={!podeCriar}
          readOnly={pendente}
          aria-busy={pendente ? true : undefined}
        />
      </div>

      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="ig-app-secret">
          Chave de assinatura do aplicativo (App Secret)
        </label>
        <Entrada
          id="ig-app-secret"
          type="password"
          value={appSecret}
          onChange={(e) => setAppSecret(e.target.value)}
          placeholder="Cole a chave inteira"
          disabled={!podeCriar}
          readOnly={pendente}
          aria-busy={pendente ? true : undefined}
        />
        <p className={estilos.ajuda}>
          É com ela que conferimos se cada mensagem veio mesmo da Meta. É a mesma do aplicativo,
          então serve a do WhatsApp oficial se for o mesmo aplicativo.
        </p>
      </div>

      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="ig-verify-token">
          Token de verificação (você escolhe)
        </label>
        <Entrada
          id="ig-verify-token"
          value={verifyToken}
          onChange={(e) => setVerifyToken(e.target.value)}
          placeholder="Invente uma senha longa e guarde-a"
          disabled={!podeCriar}
          readOnly={pendente}
          aria-busy={pendente ? true : undefined}
        />
        <p className={estilos.ajuda}>
          A Meta pede este mesmo texto ao ligar o recebimento. Mostramos ele aqui depois de criar
          o canal, para você colar lá.
        </p>
      </div>

      <div className={estilos.linhaForm}>
        {}
        <Botao
          variante="primario"
          type="button"
          onClick={criar}
          carregando={pendente}
          desabilitado={
            !podeCriar ||
            !nome.trim() ||
            !contaId.trim() ||
            !accessToken.trim() ||
            !appSecret.trim() ||
            !verifyToken.trim()
          }
        >
          <Plus size={16} strokeWidth={1.75} /> Criar canal do Instagram
        </Botao>
      </div>

      {criado && (
        <div className={estilos.segredoBloco}>
          <p className={estilos.segredoAviso}>
            Copie os dois agora — o endereço de recebimento <b>não é mostrado de novo</b>, e não
            há como descobri-lo depois.
          </p>
          <div className={estilos.linhaCopiavel}>
            <span className={estilos.segredoLabel}>url</span>
            {}
            <code className={estilos.valorMono} id="ig-copia-url">
              {criado.url}
            </code>
            {}
            <Botao
              tamanho="pequeno"
              type="button"
              onClick={() => copiar(criado.url, 'url', 'ig-copia-url')}
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
            Cole em Instagram → Configuração da API → Webhooks, no campo <b>URL de callback</b>.
          </p>
          <div className={estilos.linhaCopiavel}>
            <span className={estilos.segredoLabel}>token</span>
            <code className={estilos.valorMono} id="ig-copia-token">
              {criado.verifyToken}
            </code>
            <Botao
              tamanho="pequeno"
              type="button"
              onClick={() => copiar(criado.verifyToken, 'verify', 'ig-copia-token')}
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
            Trate esta URL como uma senha — quem a tiver consegue consumir o limite de mensagens
            deste canal. Ela não vai em print de suporte nem em grupo de WhatsApp.
          </p>
        </div>
      )}
    </>
  )
}
