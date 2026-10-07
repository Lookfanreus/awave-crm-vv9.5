import { exigirSessao } from '@/server/auth/sessao'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { criarClienteServidor } from '@/server/supabase-session'
import { carregarBoard } from '@/server/crm/kanban'
import { listarFunis } from '@/server/crm/funis'
import { listarPessoas, membroAtivo } from '@/server/crm/pessoas'
import Board from './Board'
import SeletorFunilBoard from './SeletorFunilBoard'
import estilos from './kanban.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Negócios') }
}

export default async function NegociosPage({
  searchParams,
}: {
  searchParams: Promise<{ funil?: string }>
}) {
  await exigirSessao()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return <div className={estilos.aviso}>Nenhum espaço de trabalho ativo. Recarregue a página.</div>

  const sp = await searchParams
  const [funis, board, pessoas, euId] = await Promise.all([
    listarFunis(),
    carregarBoard(cliente, ws, new Date(), sp.funil),
    
    
    listarPessoas(),
    membroAtivo(),
  ])
  if (!board.pipelineId) {
    return <div className={estilos.aviso}>Configure um pipeline padrão para ver o board.</div>
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Negócios"
        subtitulo="Arraste os cartões entre as etapas do funil."
        acoes={funis.length > 1 ? <SeletorFunilBoard funis={funis} atualId={board.pipelineId} /> : undefined}
      />
      {}
      <Board
        key={board.pipelineId}
        colunasIniciais={board.colunas}
        pessoas={pessoas}
        membroAtivoId={euId}
      />
    </>
  )
}
