'use client'








import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import EstadoVazio from '@/components/ui/EstadoVazio'



import {
  recarregarInbox,
  recarregarLista,
  recarregarThread,
  listarAtendentes,
} from '@/server/canais/inbox-leitura'
import { arquivar, atribuir, marcarLida, responder, virarNegocio } from '@/server/canais/inbox-acoes'

import type { Atendente } from '@/server/canais/inbox-leitura'
import type { ConversaLista, MensagemThread } from '@/server/canais/leitura'



import {
  PAGINA_CONVERSAS,
  cursorDeAnteriores,
  listaApos,
  listaInicial,
  mesclarMensagens,
  mesclarPaginaDeConversas,
  mesclarTopoDaLista,
  proximaPaginaDaLista,
  quantasNovas,
  semAConversa,
  threadApos,
  threadInicial,
  type EstadoDaThread,
} from '@/lib/canais/paginacao-inbox'



import { comRascunho, rascunhoDe, type Rascunhos } from '@/lib/canais/rascunhos'




import {
  FILTRO_PADRAO,
  arquivarTiraDaLista,
  type FiltroDaInbox,
} from '@/lib/canais/filtro-inbox'



import { avisoDeBuscaQueNaoRodou } from '@/lib/canais/falha-da-busca'



import { assinaturaDaInbox, type DesfechoDaLeitura } from '@/lib/canais/conexao-inbox'
import ListaConversas from './parts/ListaConversas'
import Thread from './parts/Thread'
import AcoesConversa from './parts/AcoesConversa'
import Compositor from './parts/Compositor'
import { useCanalRealtime } from './useCanalRealtime'
import estilos from './conversas.module.css'


const ESPERA_BUSCA = 300


const MENSAGEM_DE_ERRO: Record<string, string> = {
  sem_workspace: 'Sua sessão não está em nenhum espaço de trabalho. Entre de novo.',
  falha_ao_enviar: 'Não foi possível enviar. O texto continua aí — tente de novo.',
  
  
  
  
  
  canal_sem_endereco:
    'Este canal está sem o endereço do servidor de mensagens. Salve-o em Configurações → Canais antes de enviar. O texto continua aí.',
  
  
  
  
  canal_nao_encontrado:
    'Este canal não existe mais. Recarregue a página — ele pode ter sido apagado em Configurações → Canais.',
  falha_ao_arquivar: 'Não foi possível arquivar agora.',
  falha_ao_atribuir: 'Não foi possível mudar quem atende.',
  membro_invalido: 'Essa pessoa não está mais na equipe deste espaço de trabalho.',
  conversa_nao_encontrada: 'Esta conversa não existe mais.',
  
  
  
  conversa_mudou: 'Esta conversa mudou enquanto você olhava. Recarregue e tente de novo.',
  conversa_arquivada: 'Conversa arquivada. A próxima mensagem do cliente a reabre.',
  
  
  
  nada_a_devolver:
    'Esta conversa já está com o assistente. Se alguém está respondendo pelo celular, ele volta sozinho em 30 minutos.',
  sem_pipeline: 'Nenhum funil está marcado como padrão. Escolha um em Configurações.',
  sem_etapa: 'O funil padrão está sem etapas.',
  falha_ao_criar: 'Não foi possível criar o negócio agora.',
}


const AVISO_TELA_DESATUALIZADA =
  'Pronto: quem atende esta conversa já mudou. A tela ficou para trás e deve se atualizar sozinha em alguns segundos — se não atualizar, recarregue a página.'

function textoDoErro(codigo: string): string {
  return MENSAGEM_DE_ERRO[codigo] ?? 'Não foi possível concluir. Tente de novo.'
}


export default function InboxClient({
  conversasIniciais,
  supabaseUrl,
  anonKey,
  workspaceId,
}: {
  conversasIniciais: ConversaLista[]
  supabaseUrl: string
  anonKey: string
  workspaceId: string
}) {
  const router = useRouter()
  const [conversas, setConversas] = useState(conversasIniciais)
  
  const [aberta, setAberta] = useState<ConversaLista | null>(null)
  const [thread, setThread] = useState<MensagemThread[]>([])
  const [busca, setBusca] = useState('')
  
  const [filtro, setFiltro] = useState<FiltroDaInbox>(FILTRO_PADRAO)
  const [atendentes, setAtendentes] = useState<Atendente[]>([])
  
  const [rascunhos, setRascunhos] = useState<Rascunhos>({})
  
  const [telaDesatualizada, setTelaDesatualizada] = useState(false)
  
  const [enviandoEm, setEnviandoEm] = useState<ReadonlySet<string>>(() => new Set())

  
  const [estadoLista, setEstadoLista] = useState(() => listaInicial(conversasIniciais.length))
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erroMais, setErroMais] = useState<string | null>(null)
  
  const [erroBusca, setErroBusca] = useState<string | null>(null)

  const [estadoThread, setEstadoThread] = useState<EstadoDaThread>({ temAnteriores: false })
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false)
  const [erroAnteriores, setErroAnteriores] = useState<string | null>(null)
  
  const [carregouAnteriores, setCarregouAnteriores] = useState(false)
  
  const [acrescimosNoTopo, setAcrescimosNoTopo] = useState(0)

  
  
  const abertaRef = useRef<string | null>(null)
  const buscaRef = useRef('')
  
  const filtroRef = useRef<FiltroDaInbox>(FILTRO_PADRAO)
  
  const filtroDaListaRef = useRef<FiltroDaInbox>(FILTRO_PADRAO)
  
  const threadRef = useRef<MensagemThread[]>([])
  
  const marcaRef = useRef(assinaturaDaInbox({ conversas: conversasIniciais, thread: null }))
  
  const anterioresEmVooRef = useRef(false)
  useEffect(() => {
    threadRef.current = thread
  }, [thread])
  useEffect(() => {
    abertaRef.current = aberta?.id ?? null
  }, [aberta])

  
  
  
  useEffect(() => {
    setAberta((atual) => (atual ? (conversas.find((c) => c.id === atual.id) ?? atual) : atual))
  }, [conversas])
  useEffect(() => {
    buscaRef.current = busca
  }, [busca])

  
  
  
  useEffect(() => {
    void (async () => {
      try {
        setAtendentes(await listarAtendentes())
      } catch {
        
      }
    })()
  }, [])

  
  const recarregarSoLista = useCallback(
    async (pronta?: { conversas: ConversaLista[]; busca: string; filtro: FiltroDaInbox }) => {
    
    
    
    
    
    const buscaUsada = pronta?.busca ?? buscaRef.current
    const filtroUsado = pronta?.filtro ?? filtroRef.current
    const frescas =
      pronta?.conversas ??
      (await recarregarLista({ pagina: 0, busca: buscaUsada || undefined, filtro: filtroUsado }))
    
    
    
    
    if (buscaRef.current !== buscaUsada || filtroRef.current !== filtroUsado) return
    const paginaCheia = frescas.length >= PAGINA_CONVERSAS
    
    
    
    
    const outroConjunto = filtroDaListaRef.current !== filtroUsado
    filtroDaListaRef.current = filtroUsado
    setConversas((atuais) =>
      outroConjunto ? frescas : mesclarTopoDaLista(atuais, frescas, { paginaCheia }),
    )
    
    
    
    
    setTelaDesatualizada(false)
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    setErroBusca(null)
    
    
    
    
    if (outroConjunto || !paginaCheia) {
      setEstadoLista(listaInicial(frescas.length))
      
      
      
      
      setErroMais(null)
    }
    },
    [],
  )

  
  const reconciliar = useCallback(async (): Promise<DesfechoDaLeitura> => {
    const buscaUsada = buscaRef.current
    
    
    
    
    const filtroUsado = filtroRef.current
    const id = abertaRef.current
    try {
      const r = await recarregarInbox({
        pagina: 0,
        busca: buscaUsada || undefined,
        conversaAberta: id,
        filtro: filtroUsado,
      })
      if (!r.ok) return 'falhou'
      await recarregarSoLista({ conversas: r.conversas, busca: buscaUsada, filtro: filtroUsado })
      
      
      
      
      
      
      
      
      
      
      const podeMesclar =
        r.thread !== null && id !== null && abertaRef.current === id && !anterioresEmVooRef.current
      if (podeMesclar) {
        const chegaram = r.thread as MensagemThread[]
        setThread((atuais) => mesclarMensagens(atuais, chegaram))
      }
      
      
      
      
      
      
      
      
      
      
      const linha = r.linhaAberta
      if (linha) setAberta((atual) => (atual && atual.id === linha.id ? linha : atual))
      
      
      
      const marca = assinaturaDaInbox({
        conversas: r.conversas,
        thread: podeMesclar ? (r.thread as MensagemThread[]) : null,
      })
      const mudou = marca !== marcaRef.current
      marcaRef.current = marca
      return mudou ? 'novidade' : 'sem_novidade'
    } catch {
      
      
      return 'falhou'
    }
  }, [recarregarSoLista])

  
  const carregarMaisConversas = useCallback(async () => {
    const pagina = proximaPaginaDaLista(estadoLista)
    if (pagina === null || carregandoMais) return
    setCarregandoMais(true)
    setErroMais(null)
    const buscaUsada = buscaRef.current
    const filtroUsado = filtroRef.current
    try {
      const novas = await recarregarLista({
        pagina,
        busca: buscaUsada || undefined,
        filtro: filtroUsado,
      })
      
      
      
      
      if (buscaRef.current !== buscaUsada || filtroRef.current !== filtroUsado) return
      setConversas((atuais) => mesclarPaginaDeConversas(atuais, novas))
      setEstadoLista((e) => listaApos(e, { ok: true, paginaPedida: pagina, recebidas: novas.length }))
    } catch {
      
      
      setErroMais('Não foi possível carregar mais conversas. Tente de novo.')
      setEstadoLista((e) => listaApos(e, { ok: false }))
    } finally {
      setCarregandoMais(false)
    }
  }, [estadoLista, carregandoMais])

  
  const verMensagensAnteriores = useCallback(async () => {
    const id = abertaRef.current
    if (id === null || carregandoAnteriores || !estadoThread.temAnteriores) return
    const antes = cursorDeAnteriores(threadRef.current)
    if (antes === null) return
    setCarregandoAnteriores(true)
    
    
    anterioresEmVooRef.current = true
    setErroAnteriores(null)
    try {
      const anteriores = await recarregarThread(id, { antes })
      
      
      if (abertaRef.current !== id) return
      const novas = quantasNovas(threadRef.current, anteriores)
      setThread((atuais) => mesclarMensagens(atuais, anteriores))
      setEstadoThread((e) => threadApos(e, { ok: true, recebidas: anteriores.length, novas }))
      setCarregouAnteriores(true)
      
      
      
      
      setAcrescimosNoTopo((n) => n + 1)
    } catch {
      setErroAnteriores('Não foi possível carregar as mensagens anteriores. Tente de novo.')
      setEstadoThread((e) => threadApos(e, { ok: false }))
    } finally {
      anterioresEmVooRef.current = false
      setCarregandoAnteriores(false)
    }
  }, [carregandoAnteriores, estadoThread])

  
  
  
  
  
  const { aviso: avisoDaConexao } = useCanalRealtime({
    supabaseUrl,
    anonKey,
    workspaceId,
    reconciliar,
  })

  
  
  
  
  
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  
  const trocarFiltro = useCallback((novo: FiltroDaInbox) => {
    filtroRef.current = novo
    setFiltro(novo)
  }, [])

  
  
  
  
  
  
  
  
  const primeiraBusca = useRef(true)
  useEffect(() => {
    if (primeiraBusca.current) {
      primeiraBusca.current = false
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const achadas = await recarregarLista({ pagina: 0, busca: busca || undefined, filtro })
          
          
          
          
          if (buscaRef.current !== busca || filtroRef.current !== filtro) return
          
          
          
          
          
          setConversas(achadas)
          
          
          filtroDaListaRef.current = filtro
          setEstadoLista(listaInicial(achadas.length))
          setErroMais(null)
          setErroBusca(null)
        } catch {
          
          
          
          
          
          
          
          
          
          
          
          
          
          
          
          
          if (buscaRef.current !== busca || filtroRef.current !== filtro) return
          setErroBusca(
            avisoDeBuscaQueNaoRodou({ filtroPedido: filtro, filtroEmMaos: filtroDaListaRef.current }),
          )
        }
      })()
    }, ESPERA_BUSCA)
    return () => clearTimeout(t)
  }, [busca, filtro])

  const abrir = useCallback(
    (conversa: ConversaLista) => {
      const id = conversa.id
      
      
      
      
      abertaRef.current = id
      setAberta(conversa)
      setThread([])
      
      
      setEstadoThread({ temAnteriores: false })
      setErroAnteriores(null)
      setCarregouAnteriores(false)
      void (async () => {
        try {
          const mensagens = await recarregarThread(id)
          if (abertaRef.current !== id) return
          setThread(mensagens)
          
          
          setEstadoThread(threadInicial(mensagens.length))
        } catch {
          setThread([])
        }
        
        
        
        
        
        
        if (conversa.naoLidas === 0) return
        
        
        
        try {
          await marcarLida(id)
          await recarregarSoLista()
        } catch {
          
        }
      })()
    },
    [recarregarSoLista],
  )

  
  const executar = useCallback(
    async (acao: () => Promise<{ ok: true } | { erro: string }>): Promise<string | null> => {
      try {
        const r = await acao()
        if ('erro' in r) return textoDoErro(r.erro)
        return null
      } catch {
        return textoDoErro('desconhecido')
      }
    },
    [],
  )

  
  const idAberto = aberta?.id ?? ''

  return (
    <div className={estilos.duasColunas}>
      <div className={estilos.colunaLista}>
        {}
        {avisoDaConexao !== null ? (
          <p className={estilos.avisoConexao}>{avisoDaConexao}</p>
        ) : null}

        <ListaConversas
          conversas={conversas}
          abertaId={aberta?.id ?? null}
          aoAbrir={abrir}
          busca={busca}
          aoBuscar={setBusca}
          
          
          
          
          
          
          filtro={filtro}
          aoFiltrar={trocarFiltro}
          temMais={estadoLista.temMais}
          carregandoMais={carregandoMais}
          erroMais={erroMais}
          erroBusca={erroBusca}
          aoCarregarMais={carregarMaisConversas}
          
          
          
          
          mostrarFim={estadoLista.pagina > 0}
        />
      </div>

      <div className={estilos.colunaConversa}>
        {aberta === null ? (
          <EstadoVazio
            icone={<MessageSquare size={20} strokeWidth={1.75} />}
            titulo="Escolha uma conversa"
            texto="A conversa aparece aqui, com as últimas mensagens em ordem."
          />
        ) : (
          <>
            <AcoesConversa
              
              
              
              
              
              
              
              
              
              
              
              
              
              key={`acoes-${idAberto}`}
              conversa={aberta}
              atendentes={atendentes}
              aviso={telaDesatualizada ? AVISO_TELA_DESATUALIZADA : null}
              aoAtribuir={async (membroId) => {
                const falha = await executar(() => atribuir(idAberto, membroId))
                if (falha) return falha
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                try {
                  await recarregarSoLista()
                } catch {
                  setTelaDesatualizada(true)
                }
                return null
              }}
              aoArquivar={async () => {
                const falha = await executar(() => arquivar(idAberto))
                
                
                
                
                
                
                
                
                
                
                
                
                if (falha) return falha
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                if (arquivarTiraDaLista(filtroDaListaRef.current)) {
                  
                  
                  setAberta(null)
                  setThread([])
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  setConversas((atuais) => semAConversa(atuais, idAberto))
                }
                
                
                
                
                
                
                setRascunhos((r) => comRascunho(r, idAberto, ''))
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                try {
                  await recarregarSoLista()
                } catch {
                  
                }
                return null
              }}
              aoVirarNegocio={async () => {
                try {
                  const r = await virarNegocio(idAberto)
                  if ('erro' in r) return textoDoErro(r.erro)
                  
                  
                  
                  
                  router.push(`/negocios/${r.id}`)
                  return null
                } catch {
                  return textoDoErro('falha_ao_criar')
                }
              }}
            />

            {}
            <Thread
              mensagens={thread}
              conversaId={idAberto}
              acrescimosNoTopo={acrescimosNoTopo}
              temAnteriores={estadoThread.temAnteriores}
              carregandoAnteriores={carregandoAnteriores}
              erroAnteriores={erroAnteriores}
              aoVerAnteriores={verMensagensAnteriores}
              
              
              mostrarInicio={carregouAnteriores}
            />

            <Compositor
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              key={`compositor-${idAberto}`}
              
              
              
              
              
              provider={aberta.provider}
              ultimaEntradaIso={aberta.ultimaEntradaIso}
              agoraMs={agora}
              rascunho={rascunhoDe(rascunhos, idAberto)}
              aoRascunhar={(texto) => setRascunhos((r) => comRascunho(r, idAberto, texto))}
              enviando={enviandoEm.has(idAberto)}
              aoEnviar={async (texto) => {
                
                
                
                
                setEnviandoEm((s) => new Set(s).add(idAberto))
                try {
                  const falha = await executar(() => responder(idAberto, texto))
                  if (falha) return falha
                  
                  
                  
                  setRascunhos((r) => comRascunho(r, idAberto, ''))
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  
                  await reconciliar()
                  return null
                } finally {
                  setEnviandoEm((s) => {
                    const resto = new Set(s)
                    resto.delete(idAberto)
                    return resto
                  })
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
