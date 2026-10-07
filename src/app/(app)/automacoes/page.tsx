import Link from 'next/link'
import { AlertTriangle, Plus } from 'lucide-react'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { listarAutomacoes, listarExecucoes } from '@/server/crm/automacoes'
import { listarFunis, carregarFunil } from '@/server/crm/funis'
import { listarTiposCompleto } from '@/server/crm/tipos'
import { listarCampos } from '@/server/crm/campos-def'
import { descreverGatilho } from '@/lib/automacao-rotulos'
import { resumirExecucao, podeAtribuirAAutomacao, avisoDisjuntor } from '@/lib/automacao-log'
import ListaAutomacoes, { type LinhaAutomacao } from './ListaAutomacoes'
import EditorRegra, { type AutomacaoParaEditar, type EtapaOpcao } from './EditorRegra'
import LogExecucoes, { type LinhaLog } from './LogExecucoes'
import VazioAutomacoes from './VazioAutomacoes'
import Botao from '@/components/ui/Botao'
import estilos from './automacoes.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Automações') }
}

const PAGINA_TAM = 20
const JANELA_DISJUNTOR_MS = 24 * 60 * 60 * 1000


export default async function AutomacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string; pagina?: string; modelo?: string }>
}) {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  const sp = await searchParams

  if (!ws) {
    return (
      <div className={estilos.pagina}>
        <CabecalhoPagina titulo="Automações" />
        <p className={estilos.erro}>Não foi possível identificar seu espaço de trabalho.</p>
      </div>
    )
  }

  const pagina = Math.max(1, Number(sp.pagina) || 1)
  const offset = (pagina - 1) * PAGINA_TAM

  const [automacoes, funis, tiposAtividade, camposNegocio, execucoesPagina, canceladasRecentes] = await Promise.all([
    listarAutomacoes(ws),
    listarFunis(),
    listarTiposCompleto(),
    listarCampos('negocio'),
    listarExecucoes(ws, { limit: PAGINA_TAM + 1, offset }),
    listarExecucoes(ws, { estado: 'cancelado', desde: new Date(Date.now() - JANELA_DISJUNTOR_MS).toISOString(), limit: 50 }),
  ])

  
  
  const detalhesFunis = await Promise.all(funis.map((f) => carregarFunil(f.id)))
  const etapas: EtapaOpcao[] = detalhesFunis.flatMap((d, i) =>
    d ? d.etapas.map((e) => ({ id: e.id, nome: e.nome, funilNome: funis[i].nome })) : [])
  const nomeEtapaPorId = new Map(etapas.map((e) => [e.id, e.nome]))

  
  
  
  
  
  
  
  const motivosCancelamento = canceladasRecentes.map((e) => (e.resultado as { motivo?: string } | null)?.motivo)
  const avisoBanner = avisoDisjuntor(motivosCancelamento)

  
  const ultimas = await Promise.all(automacoes.map((a) => listarExecucoes(ws, { automacaoId: a.id, limit: 1 })))

  const linhasLista: LinhaAutomacao[] = automacoes.map((a, i) => {
    const ultima = ultimas[i][0]
    
    
    
    
    const atribuivel = ultima && podeAtribuirAAutomacao(ultima.estado, ultima.resultado)
    return {
      id: a.id,
      nome: a.nome,
      ativo: a.ativo,
      gatilhoLegivel: descreverGatilho(a.gatilho, a.gatilho_config, (id) => nomeEtapaPorId.get(id)),
      numAcoes: Array.isArray(a.acoes) ? a.acoes.length : 0,
      
      
      
      ultimoResultado: atribuivel
        ? resumirExecucao(ultima.estado, ultima.resultado, ultima.ultimo_erro, a.acoes, ultima.tentativas)
        : null,
    }
  })

  
  const modoEdicao = sp.editar ?? null
  const editando = modoEdicao !== null
  const automacaoSelecionada = modoEdicao === 'novo' ? undefined : automacoes.find((a) => a.id === modoEdicao)
  const paraEditar: AutomacaoParaEditar | null = automacaoSelecionada
    ? {
        id: automacaoSelecionada.id,
        nome: automacaoSelecionada.nome,
        gatilho: automacaoSelecionada.gatilho,
        gatilho_config: automacaoSelecionada.gatilho_config,
        condicoes: automacaoSelecionada.condicoes,
        acoes: automacaoSelecionada.acoes,
      }
    : null

  
  
  const nomeAutomacaoPorId = new Map(automacoes.map((a) => [a.id, a.nome]))
  const acoesPorAutomacaoId = new Map(automacoes.map((a) => [a.id, a.acoes]))
  const idsNegocio = [...new Set(execucoesPagina.map((e) => e.negocio_id).filter((x): x is string => !!x))]
  let tituloPorNegocioId = new Map<string, string>()
  if (idsNegocio.length > 0) {
    const { data } = await cliente.from('negocios').select('id, titulo').eq('workspace_id', ws).in('id', idsNegocio)
    tituloPorNegocioId = new Map(((data as { id: string; titulo: string }[] | null) ?? []).map((n) => [n.id, n.titulo]))
  }

  const temProxima = execucoesPagina.length > PAGINA_TAM
  const linhasLog: LinhaLog[] = execucoesPagina.slice(0, PAGINA_TAM).map((e) => {
    const resumo = resumirExecucao(e.estado, e.resultado, e.ultimo_erro, acoesPorAutomacaoId.get(e.automacao_id), e.tentativas)
    
    
    
    const atribuivel = podeAtribuirAAutomacao(e.estado, e.resultado)
    return {
      id: e.id,
      quando: e.criado_em,
      automacaoNome: atribuivel ? (nomeAutomacaoPorId.get(e.automacao_id) ?? '—') : '— (disjuntor)',
      negocioId: e.negocio_id,
      negocioTitulo: e.negocio_id ? tituloPorNegocioId.get(e.negocio_id) ?? null : null,
      texto: resumo.texto,
      tom: resumo.tom,
    }
  })

  return (
    <div className={estilos.pagina}>
      {}
      {}
      <CabecalhoPagina
        titulo="Automações"
        subtitulo={
          automacoes.length > 0 || editando
            ? 'Regras "quando X, faça Y" que rodam sozinhas. O motor confere a cada ~30 segundos — uma automação leva em até 1 minuto para agir depois do gatilho.'
            : undefined
        }
        acoes={
          automacoes.length > 0 ? (
            <Botao href="/automacoes?editar=novo" variante="primario">
              <Plus size={16} strokeWidth={2} /> Nova automação
            </Botao>
          ) : undefined
        }
      />

      {avisoBanner && (
        <div className={estilos.avisoDisjuntor}>
          <AlertTriangle size={16} strokeWidth={1.75} />
          {avisoBanner}
        </div>
      )}

      {}
      {automacoes.length === 0 && !editando ? (
        <VazioAutomacoes />
      ) : (
        <div className={editando ? estilos.layout : estilos.layoutSolo}>
          <ListaAutomacoes
            automacoes={linhasLista}
            selecionadoId={modoEdicao === 'novo' ? null : modoEdicao}
            compacta={editando}
          />
          {editando && (
            <EditorRegra
              automacao={paraEditar}
              etapas={etapas}
              tipos={tiposAtividade.filter((t) => t.ativo).map((t) => ({ slug: t.slug, nome: t.nome }))}
              campos={camposNegocio.filter((c) => c.ativo).map((c) => ({ slug: c.slug, rotulo: c.rotulo }))}
              modeloInicial={sp.modelo ?? null}
            />
          )}
        </div>
      )}

      {}
      {automacoes.length > 0 && (
        <LogExecucoes linhas={linhasLog} pagina={pagina} temProxima={temProxima} editarAtual={modoEdicao ?? ''} />
      )}
    </div>
  )
}
