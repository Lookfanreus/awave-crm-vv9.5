'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Check, Trash2, Plug } from 'lucide-react'
import { gerarCredencial, revogarCredencial, testarConexao, salvarWebhook, gerarSegredoWebhook } from './acoes'
import { copiarTexto, fraseDeFalhaAoCopiar, selecionarNaTela } from '@/lib/copiar'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './config.module.css'

export type CredencialItem = { key_id: string; rotulo: string; criado_em: string }
export type WebhookConfig = { endpoint_url: string; ativo: boolean }

type SegredoNovo = { keyId: string; segredo: string }


export default function PlugarIA({
  urlBase,
  credenciais,
  webhook,
}: {
  urlBase: string
  credenciais: CredencialItem[]
  webhook?: WebhookConfig | null
}) {
  const router = useRouter()
  const [rotulo, setRotulo] = useState('')
  const [novo, setNovo] = useState<SegredoNovo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  
  const [semCopia, setSemCopia] = useState<{ marca: string; selecionou: boolean } | null>(null)
  const [teste, setTeste] = useState<Record<string, 'ok' | 'falha'>>({})
  const [pendente, iniciar] = useTransition()

  
  const [endpoint, setEndpoint] = useState(webhook?.endpoint_url ?? '')
  const [ativo, setAtivo] = useState(webhook?.ativo ?? true)
  const [erroWh, setErroWh] = useState<string | null>(null)
  const [salvoWh, setSalvoWh] = useState(false)
  const [segredoWh, setSegredoWh] = useState<string | null>(null)

  
  async function copiar(texto: string, marca: string, alvoId: string) {
    setSemCopia(null)
    if (await copiarTexto(texto, navigator.clipboard)) {
      setCopiado(marca)
      setTimeout(() => setCopiado((m) => (m === marca ? null : m)), 1500)
      return
    }
    setSemCopia({ marca, selecionou: selecionarNaTela(alvoId) })
  }

  function gerar() {
    setErro(null)
    iniciar(async () => {
      const r = await gerarCredencial(rotulo)
      if ('erro' in r) {
        setErro(r.erro === 'rotulo_obrigatorio' ? 'Dê um rótulo à credencial.' : 'Não foi possível gerar. Tente de novo.')
        return
      }
      setNovo({ keyId: r.keyId, segredo: r.segredo })
      setRotulo('')
      router.refresh()
    })
  }

  function revogar(keyId: string) {
    iniciar(async () => {
      await revogarCredencial(keyId)
      if (novo?.keyId === keyId) setNovo(null)
      router.refresh()
    })
  }

  function testar(keyId: string) {
    iniciar(async () => {
      const r = await testarConexao(keyId)
      setTeste((t) => ({ ...t, [keyId]: r.ok ? 'ok' : 'falha' }))
    })
  }

  function salvarWh() {
    setErroWh(null); setSalvoWh(false)
    iniciar(async () => {
      const r = await salvarWebhook({ endpoint_url: endpoint, ativo })
      if ('erro' in r) {
        setErroWh(r.erro === 'url_invalida' ? 'Use uma URL https://' : 'Não foi possível salvar. Tente de novo.')
        return
      }
      setSalvoWh(true)
      setTimeout(() => setSalvoWh(false), 1500)
      router.refresh()
    })
  }

  function gerarSegWh() {
    setErroWh(null)
    iniciar(async () => {
      const r = await gerarSegredoWebhook()
      if ('erro' in r) { setErroWh('Não foi possível gerar o segredo. Tente de novo.'); return }
      setSegredoWh(r.segredo)
    })
  }

  return (
    <>
      {}
      <section className={estilos.bloco}>
        <div className={estilos.blocoCab}>
          <h2 className={estilos.blocoTitulo}>Credencial de API</h2>
        </div>

        {}
        <div className={estilos.campo}>
          <span className={estilos.rotulo}>URL do seu CRM</span>
          <div className={estilos.linhaCopiavel}>
            {}
            <code className={estilos.valorMono} id="api-copia-url">{urlBase}</code>
            <Botao tamanho="pequeno" type="button" onClick={() => copiar(urlBase, 'url', 'api-copia-url')}>
              {copiado === 'url' ? <Check size={14} /> : <Copy size={14} />}
              {copiado === 'url' ? 'Copiado' : 'Copiar'}
            </Botao>
          </div>
          {semCopia?.marca === 'url' ? (
            <p className={estilos.erro} role="alert">{fraseDeFalhaAoCopiar(semCopia.selecionou)}</p>
          ) : null}
        </div>

        {}
        <div className={estilos.campo}>
          <label className={estilos.rotulo} htmlFor="rotulo-cred">Nova credencial</label>
          <div className={estilos.linhaForm}>
            <Entrada
              id="rotulo-cred"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Rótulo (ex.: Motor de produção)"
              disabled={pendente}
            />
            <Botao variante="primario" type="button" onClick={gerar} carregando={pendente} desabilitado={!rotulo.trim()}>
              <Plus size={16} strokeWidth={1.75} /> Gerar
            </Botao>
          </div>
        </div>
        {erro && <p className={estilos.erro} role="alert">{erro}</p>}

        {}
        {novo && (
          <div className={estilos.segredoBloco}>
            <p className={estilos.segredoAviso}>
              Copie o segredo agora — por segurança, ele <b>não será mostrado de novo</b>.
            </p>
            <div className={estilos.linhaCopiavel}>
              <span className={estilos.segredoLabel}>key-id</span>
              <code className={estilos.valorMono} id="api-copia-keyid">{novo.keyId}</code>
              <Botao tamanho="pequeno" type="button" onClick={() => copiar(novo.keyId, 'keyid', 'api-copia-keyid')}>
                {copiado === 'keyid' ? <Check size={14} /> : <Copy size={14} />}
              </Botao>
            </div>
            {semCopia?.marca === 'keyid' ? (
              <p className={estilos.erro} role="alert">{fraseDeFalhaAoCopiar(semCopia.selecionou)}</p>
            ) : null}
            <div className={estilos.linhaCopiavel}>
              <span className={estilos.segredoLabel}>segredo</span>
              <code className={estilos.valorMono} id="api-copia-segredo">{novo.segredo}</code>
              <Botao tamanho="pequeno" type="button" onClick={() => copiar(novo.segredo, 'seg', 'api-copia-segredo')}>
                {copiado === 'seg' ? <Check size={14} /> : <Copy size={14} />}
              </Botao>
            </div>
            {semCopia?.marca === 'seg' ? (
              <p className={estilos.erro} role="alert">{fraseDeFalhaAoCopiar(semCopia.selecionou)}</p>
            ) : null}
          </div>
        )}

        {}
        <p className={estilos.rotuloSecao}>
          <span>Credenciais ativas</span>
          <span>{credenciais.length}</span>
        </p>
        {credenciais.length === 0 ? (
          <p className={estilos.vazio}>Nenhuma credencial ainda — gere a primeira para conectar outro sistema a este CRM.</p>
        ) : (
          <ul className={estilos.lista}>
            {credenciais.map((c) => (
              <li key={c.key_id} className={estilos.item}>
                <div className={estilos.itemInfo}>
                  <span className={estilos.itemRotulo}>{c.rotulo}</span>
                  <code className={estilos.itemKeyId}>{c.key_id}</code>
                </div>
                <div className={estilos.acoes}>
                  {teste[c.key_id] === 'ok' && <span className={estilos.testeOk}><Check size={14} strokeWidth={1.75} /> conectado</span>}
                  {teste[c.key_id] === 'falha' && <span className={estilos.testeFalha}>falhou</span>}
                  <Botao variante="fantasma" tamanho="pequeno" type="button" onClick={() => testar(c.key_id)} carregando={pendente}>
                    <Plug size={14} strokeWidth={1.75} /> Testar
                  </Botao>
                  <Botao variante="fantasma" tamanho="pequeno" tom="erro" type="button" onClick={() => revogar(c.key_id)} carregando={pendente}>
                    <Trash2 size={14} strokeWidth={1.75} /> Revogar
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {}
      <section className={estilos.bloco}>
        <div className={estilos.blocoCab}>
          <h2 className={estilos.blocoTitulo}>Webhook de eventos</h2>
          <span className={estilos.blocoMeta}>{webhook?.ativo ? 'enviando' : 'não configurado'}</span>
        </div>

        <p className={estilos.ajuda}>
          O CRM avisa sua IA quando algo acontece (lead novo, negócio criado, etapa mudou, ganho/perdido).
          Aponte o endpoint da sua IA e gere um segredo — o CRM assina cada evento com ele.
        </p>

        {}
        <div className={estilos.campo}>
          <label className={estilos.rotulo} htmlFor="wh-endpoint">Endpoint da sua IA</label>
          <div className={estilos.linhaForm}>
            <Entrada
              id="wh-endpoint"
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://sua-ia.exemplo.com/webhooks/crm"
              disabled={pendente}
            />
            <Botao variante="primario" type="button" onClick={salvarWh} carregando={pendente} desabilitado={!endpoint.trim()}>
              {salvoWh ? <Check size={16} strokeWidth={1.75} /> : null} {salvoWh ? 'Salvo' : 'Salvar'}
            </Botao>
          </div>
          <label className={estilos.toggle}>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} disabled={pendente} />
            Enviar eventos para este endpoint
          </label>
        </div>
        {erroWh && <p className={estilos.erro} role="alert">{erroWh}</p>}

        {}
        <div className={estilos.campo}>
          <span className={estilos.rotulo}>Segredo do webhook</span>
          <div className={estilos.linhaForm}>
            <Botao variante="primario" type="button" onClick={gerarSegWh} carregando={pendente}>
              <Plus size={16} strokeWidth={1.75} /> Gerar segredo
            </Botao>
          </div>
        </div>
        {segredoWh && (
          <div className={estilos.segredoBloco}>
            <p className={estilos.segredoAviso}>
              Copie o segredo agora — por segurança, ele <b>não será mostrado de novo</b>. Cole na sua IA
              pra ela validar a assinatura dos eventos.
            </p>
            <div className={estilos.linhaCopiavel}>
              <span className={estilos.segredoLabel}>segredo</span>
              <code className={estilos.valorMono} id="api-copia-segredo-webhook">{segredoWh}</code>
              <Botao tamanho="pequeno" type="button" onClick={() => copiar(segredoWh, 'whseg', 'api-copia-segredo-webhook')}>
                {copiado === 'whseg' ? <Check size={14} /> : <Copy size={14} />}
              </Botao>
            </div>
            {semCopia?.marca === 'whseg' ? (
              <p className={estilos.erro} role="alert">{fraseDeFalhaAoCopiar(semCopia.selecionou)}</p>
            ) : null}
          </div>
        )}
      </section>
    </>
  )
}
