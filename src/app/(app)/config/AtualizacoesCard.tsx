'use client'

import { useState, useTransition, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  salvarTokenGitHub,
  salvarRepo,
  salvarGatilho,
  removerTokenGitHub,
  dispararAtualizacao,
  dispararReversao,
  lerAndamento,
  type VistaAtualizacao,
} from './acoes-atualizacao'
import { LINK_CRIAR_TOKEN } from '@/lib/atualizacao'
import { estaEmAndamento, type FaseAtualizacao } from '@/lib/estado-atualizacao'
import { textoDoRebuild } from '@/lib/gatilho-implantacao'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './config.module.css'


const TEXTO_DA_FASE: Record<FaseAtualizacao, string> = {
  baixando: 'Baixando a versão nova…',
  extraindo: 'Abrindo os arquivos…',
  publicando: 'Enviando para o seu repositório…',
  aguardando_rebuild: 'Enviado para o seu repositório.',
  erro: 'A atualização não terminou.',
}




export default function AtualizacoesCard({ inicial }: { inicial: VistaAtualizacao }) {
  const [vista, setVista] = useState(inicial)
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState(inicial.repo ?? '')
  
  const [gatilho, setGatilho] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  
  const [ultimoInicial, setUltimoInicial] = useState(inicial)
  if (inicial !== ultimoInicial) {
    setUltimoInicial(inicial)
    setVista(inicial)
  }

  const rodando = estaEmAndamento(vista.andamento)

  
  useEffect(() => {
    if (!rodando) return
    const id = setInterval(async () => {
      const r = await lerAndamento()
      if (!('erro' in r)) setVista(r)
    }, 4000)
    return () => clearInterval(id)
  }, [rodando])

  function aplicar(r: { ok: true; vista: VistaAtualizacao } | { erro: string }) {
    if ('erro' in r) {
      setErro(
        r.erro === 'nao_autorizado' ? 'Só o dono deste servidor pode configurar isto.'
        : r.erro === 'token_formato' ? 'Isso não parece um token. Copie o valor que começa com "github_pat_" — não o nome que você deu a ele.'
        : r.erro === 'token_vazio' ? 'Cole o token antes de salvar.'
        : r.erro === 'repo_vazio' ? 'Informe o repositório.'
        : r.erro === 'repo_formato' ? 'Use o endereço do repositório, no formato "seu-usuario/nome-do-repositorio".'
        : r.erro === 'repo_dono' || r.erro === 'repo_nome' ? 'Esse endereço de repositório não é válido no GitHub.'
        : r.erro === 'gatilho_formato' ? 'Isso não parece o endereço do Gatilho de Implantação. Ele começa com "http://" ou "https://" e você copia do EasyPanel, na aba Implantações.'
        
        
        
        
        
        : r.erro === 'token_nao_removido' ? 'Não consegui apagar o token: ele continua guardado aqui. Tente de novo — e se você acha que ele vazou, exclua o token no GitHub agora, sem esperar.'
        : 'Não consegui salvar. Tente de novo.',
      )
      return
    }
    setErro(null)
    setToken('')
    setGatilho('')
    setVista(r.vista)
  }

  
  async function disparar(acao: () => Promise<{ ok: true } | { erro: string }>) {
    const r = await acao()
    if ('erro' in r) {
      setErro(
        r.erro === 'nao_autorizado' ? 'Só o dono deste servidor pode atualizar.'
        : r.erro === 'ja_rodando' ? 'Já tem uma atualização em andamento.'
        : r.erro === 'sem_alvo' ? 'Não há uma versão nova confirmada para instalar.'
        : r.erro === 'faltando_config' ? 'Configure o repositório e o token antes de atualizar.'
        : r.erro === 'sem_licenca' ? 'A atualização em um clique precisa de uma licença ativa.'
        : r.erro === 'nada_a_reverter' ? 'Não há uma atualização recente para desfazer.'
        : 'Não consegui começar. Tente de novo.',
      )
      return
    }
    setErro(null)
    const v = await lerAndamento()
    if (!('erro' in v)) setVista(v)
  }

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Atualizações</h2>
        <span className={estilos.blocoMeta}>Vale para o servidor inteiro</span>
      </div>

      {vista.estado === 'sem_licenca' ? (
        <>
          <p className={estilos.frase}>A atualização em um clique precisa de uma licença ativa.</p>
          <p className={estilos.ajuda}>
            Seu CRM continua funcionando normalmente — nada aqui é bloqueado. Para atualizar,
            siga o passo a passo do guia de instalação (substituir os arquivos e fazer deploy).
          </p>
        </>
      ) : (
        <>
          <p className={estilos.frase}>
            {vista.estado === 'ha_versao_nova' ? `Há uma versão nova: ${vista.versaoMaisNova}.`
              : vista.estado === 'em_dia' ? 'Você está na versão mais recente.'
              : vista.estado === 'faltando_config' ? 'Falta configurar o acesso ao seu repositório.'
              : 'Ainda não consegui confirmar qual é a versão mais recente.'}
          </p>
          <p className={estilos.ajuda}>
            Versão instalada: <strong>{vista.versaoAtual ?? 'desenvolvimento'}</strong>
            {vista.estado === 'indeterminado'
              ? ' — enquanto eu não confirmar a versão mais recente, não vou dizer que você está em dia.'
              : null}
          </p>

          {}
          {vista.andamento ? (
            <div className={estilos.andamento} role="status" aria-live="polite">
              <p className={estilos.frase}>
                {vista.andamento.fase === 'aguardando_rebuild'
                  ? textoDoRebuild(vista.resultadoGatilho?.tipo ?? null).frase
                  : TEXTO_DA_FASE[vista.andamento.fase]}
              </p>
              {}
              {vista.andamento.fase === 'aguardando_rebuild' &&
              vista.resultadoGatilho?.tipo === 'falhou' &&
              vista.resultadoGatilho.detalhe ? (
                <p className={estilos.ajuda}>
                  O painel respondeu: <code>{vista.resultadoGatilho.detalhe}</code>
                </p>
              ) : null}
              {vista.andamento.fase === 'erro' && vista.andamento.erro ? (
                
                
                <p className={estilos.erro}>{vista.andamento.erro}</p>
              ) : null}
              {rodando ? (
                <p className={estilos.ajuda}>
                  Pode fechar esta página — o trabalho continua no servidor.
                </p>
              ) : null}
            </div>
          ) : null}

          {}
          {vista.estado === 'ha_versao_nova' && !rodando ? (
            <>
              {vista.divergentes ? (
                <p className={estilos.ajuda}>
                  Encontrei <strong>{vista.divergentes}</strong>{' '}
                  {vista.divergentes === 1 ? 'arquivo diferente' : 'arquivos diferentes'} do
                  original no seu repositório. Antes de atualizar eu salvo uma cópia deles num
                  branch de backup — nada é perdido.
                </p>
              ) : null}
              <div className={estilos.linhaForm}>
                <Botao variante="primario"
                  carregando={pendente}
                  onClick={() => iniciar(async () => disparar(dispararAtualizacao))}
                >
                  Atualizar para {vista.versaoMaisNova}
                </Botao>
              </div>
              {}
              <p className={estilos.ajuda}>
                {vista.gatilho
                  ? 'Isto envia a versão nova para o seu repositório no GitHub e avisa o seu servidor, que reconstrói sozinho. Leva alguns minutos.'
                  : 'Isto envia a versão nova para o seu repositório no GitHub. Depois você precisa abrir o EasyPanel e clicar em Deploy uma vez — a menos que configure o Gatilho de Implantação abaixo, e aí passa a ser automático.'}
              </p>
            </>
          ) : null}

          {}
          {vista.podeReverter && !rodando ? (
            <details className={estilos.tutorial}>
              <summary>Desfazer a última atualização</summary>
              {}
              <p className={estilos.ajuda}>
                Volta o <strong>código</strong> para a versão anterior.{' '}
                <strong>Não desfaz mudanças no banco de dados</strong> — se a atualização
                criou ou removeu campos, eles continuam como estão. Use isto só se a versão
                nova quebrou algo, e chame o suporte em seguida.
              </p>
              {}
              <p className={estilos.ajuda}>
                <strong>E tem um efeito que a frase acima não cobre:</strong> esta versão mudou
                quem pode gravar no seu banco de dados. Se você desfizer, a versão anterior{' '}
                <strong>para de salvar</strong> o que você digita: criar um contato dá erro na
                tela, e editar um cadastro ou mover um cartão no kanban diz que salvou{' '}
                <strong>sem gravar nada</strong> — este é o pior dos dois, porque não aparece.
                Quem ainda não tem um espaço de trabalho também não consegue criar o primeiro.{' '}
                <strong>Nada é apagado:</strong> o que já está gravado continua lá, e tudo volta
                ao normal assim que você atualizar de novo. Enquanto estiver na versão antiga,
                evite editar cadastros — e chame o suporte.
              </p>
              <p className={estilos.ajuda}>
                <strong>Mas nem tudo continua como está para você:</strong> a versão antiga
                volta a ler as coisas do jeito dela. Hoje isso afeta o{' '}
                <strong>assistente</strong> — a personalidade dele volta ao texto que tinha no
                dia da atualização, e os assistentes que você criou depois deixam de responder.{' '}
                <strong>Nada é apagado:</strong> tudo volta a valer quando você atualizar de
                novo. Não reescreva nada antes de falar com o suporte.
              </p>
              {}
              <p className={estilos.ajuda}>
                <strong>E o recorte por assistente da base de conhecimento deixa de valer</strong>{' '}
                até você atualizar de novo — todo assistente volta a enxergar todas as entradas,
                mesmo as que você tinha restringido. O assistente continua respondendo e
                consultando a base normalmente. <strong>Nada é apagado:</strong> o recorte
                continua gravado, e volta a valer assim que você atualizar de novo.
              </p>
              <div className={estilos.acoes}>
                <Botao variante="fantasma" tamanho="pequeno" tom="erro"
                  carregando={pendente}
                  onClick={() => iniciar(async () => disparar(dispararReversao))}
                >
                  Desfazer
                </Botao>
              </div>
            </details>
          ) : null}

          {}
          <details className={estilos.tutorial} open={vista.estado === 'faltando_config'}>
            <summary>Como conectar o seu repositório (uma vez só)</summary>
            <ol className={estilos.passos}>
              <li>
                <a href={LINK_CRIAR_TOKEN} target="_blank" rel="noopener noreferrer" className={estilos.linkExterno}>
                  Abrir a criação do token no GitHub
                  <ExternalLink size={12} strokeWidth={1.75} />
                </a>
                <span className={estilos.ajuda}>Abre em outra aba. Você precisa estar logado na conta que tem o repositório do seu CRM.</span>
              </li>
              {}
              <li>Em <strong>Token name</strong>, escreva algo que você reconheça depois, como <code>CRM</code>.</li>
              <li>Em <strong>Expiration</strong>, escolha o prazo que preferir. Quando vencer, você refaz este passo a passo.</li>
              <li>
                Em <strong>Repository access</strong>, marque <strong>Only select repositories</strong> e escolha
                <strong> apenas o repositório do seu CRM</strong>.
                <span className={estilos.ajuda}>Assim o token não alcança nenhum outro repositório seu.</span>
              </li>
              <li>
                Em <strong>Permissions → Repository permissions</strong>, encontre <strong>Contents</strong> e
                mude para <strong>Read and write</strong>. Não precisa marcar mais nada.
              </li>
              <li>Clique em <strong>Generate token</strong> e copie o valor que aparece — ele começa com <code>github_pat_</code>.</li>
              <li>
                Volte aqui e cole abaixo.
                <span className={estilos.ajuda}>O GitHub mostra esse valor <strong>uma vez só</strong>. Se você fechar a página sem copiar, é só refazer.</span>
              </li>
            </ol>
          </details>

          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor="update-repo">Repositório do seu CRM</label>
            <div className={estilos.linhaForm}>
              <Entrada
                id="update-repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="seu-usuario/nome-do-repositorio"
                autoComplete="off"
                spellCheck={false}
                disabled={pendente}
              />
              <Botao variante="primario"
                carregando={pendente} desabilitado={!repo.trim()}
                onClick={() => iniciar(async () => aplicar(await salvarRepo(repo)))}
              >
                Salvar
              </Botao>
            </div>
          </div>
          <p className={estilos.ajuda}>Pode colar o endereço completo do navegador — eu extraio o que preciso.</p>

          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor="update-token">
              Token do GitHub{' '}
              {vista.temToken
                ? <span className={`${estilos.selo} ${estilos.selo_ok}`}>já configurado</span>
                : null}
            </label>
            <div className={estilos.linhaForm}>
              <Entrada
                id="update-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={vista.temToken ? 'Colar outro token…' : 'github_pat_…'}
                autoComplete="off"
                spellCheck={false}
                disabled={pendente}
              />
              <Botao variante="primario"
                carregando={pendente} desabilitado={!token.trim()}
                onClick={() => iniciar(async () => aplicar(await salvarTokenGitHub(token)))}
              >
                Salvar
              </Botao>
            </div>
          </div>

          {vista.temToken ? (
            <div className={estilos.acoes}>
              <Botao variante="fantasma" tamanho="pequeno" tom="erro"
                carregando={pendente}
                onClick={() => iniciar(async () => aplicar(await removerTokenGitHub()))}
              >
                Remover token
              </Botao>
            </div>
          ) : null}
          <p className={estilos.ajuda}>
            O token fica guardado criptografado no seu banco e nunca é mostrado de volta nesta tela.
            Se achar que ele vazou, remova aqui <strong>e</strong> exclua o token no GitHub.
          </p>

          {}
          <details className={estilos.tutorial} open={!vista.gatilho}>
            <summary>Como fazer o servidor reconstruir sozinho (uma vez só)</summary>
            <p className={estilos.ajuda}>
              Enviar a versão nova para o seu repositório é só metade do caminho: quem
              reconstrói o servidor é o EasyPanel, e alguém precisa avisá-lo. Cole o endereço
              abaixo e quem avisa passa a ser o próprio CRM — você não precisa fazer mais nada
              depois de clicar em atualizar.
            </p>
            <ol className={estilos.passos}>
              <li>
                No EasyPanel, abra o <strong>serviço do seu CRM</strong> e vá na aba{' '}
                <strong>Implantações</strong>
                <span className={estilos.ajuda}>Ou nome parecido, tipo <em>Deployments</em> — o painel muda os nomes de vez em quando.</span>
              </li>
              <li>
                Role até <strong>Gatilho de Implantação</strong> e copie a{' '}
                <strong>URL</strong> — parecida com <code>http://…/api/deploy/…</code>
                <span className={estilos.ajuda}>Ela é única do seu serviço.</span>
              </li>
              <li>Cole no campo abaixo e salve.</li>
            </ol>
          </details>

          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor="update-gatilho">
              Gatilho de Implantação{' '}
              {vista.gatilho
                ? <span className={`${estilos.selo} ${estilos.selo_ok}`}>já configurado</span>
                : null}
            </label>
            <div className={estilos.linhaForm}>
              <Entrada
                id="update-gatilho"
                type="password"
                value={gatilho}
                onChange={(e) => setGatilho(e.target.value)}
                placeholder={vista.gatilho ? 'Colar outro endereço…' : 'http://…/api/deploy/…'}
                autoComplete="off"
                spellCheck={false}
                disabled={pendente}
              />
              <Botao variante="primario"
                carregando={pendente} desabilitado={!gatilho.trim()}
                onClick={() => iniciar(async () => aplicar(await salvarGatilho(gatilho)))}
              >
                Salvar
              </Botao>
            </div>
          </div>

          {vista.gatilho ? (
            <>
              <p className={estilos.ajuda}>
                Configurado: <code>{vista.gatilho}</code>
              </p>
              <div className={estilos.acoes}>
                <Botao variante="fantasma" tamanho="pequeno" tom="erro"
                  carregando={pendente}
                  onClick={() => iniciar(async () => aplicar(await salvarGatilho('')))}
                >
                  Remover gatilho
                </Botao>
              </div>
            </>
          ) : null}
          <p className={estilos.ajuda}>
            Esse endereço também é secreto — quem tiver ele consegue mandar o seu servidor
            reconstruir. Ele fica criptografado no seu banco e nunca é mostrado de volta
            inteiro nesta tela.
          </p>
        </>
      )}

      {erro ? <p className={estilos.erro} role="alert">{erro}</p> : null}
    </section>
  )
}
