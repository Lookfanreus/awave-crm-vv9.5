import { notFound, redirect } from 'next/navigation'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { listarFunis } from '@/server/crm/funis'
import { buscarRelatorio, listarRelatorios, opcoesAgrupamento, rodarRelatorio } from '@/server/crm/relatorios'
import { configDeParams, ehTipoRelatorio } from '@/lib/relatorios'
import Construtor from '../Construtor'
import ListaSalvos from '../ListaSalvos'
import Resultado from '../Resultado'
import estilos from '../relatorios.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Relatório') }
}


export default async function RelatorioSalvoPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) redirect('/sem-workspace')

  const { id } = await params
  const salvo = await buscarRelatorio(cliente, ws, id)
  if (!salvo) notFound()   

  const sp = await searchParams
  const tipoParam = sp.tipo
  const experimentando = ehTipoRelatorio(tipoParam)
  const tipo = experimentando ? tipoParam : salvo.tipo
  const config = experimentando ? configDeParams(sp) : salvo.config

  const [salvos, funis] = await Promise.all([listarRelatorios(cliente, ws), listarFunis()])
  const funilEfetivo = config.funilId ?? funis.find((f) => f.is_padrao)?.id
  const agrupamentos = await opcoesAgrupamento(cliente, ws, funilEfetivo)
  const resultado = await rodarRelatorio(cliente, ws, tipo, config)

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo={salvo.nome}
        subtitulo="Pergunta salva deste espaço de trabalho. O resultado é sempre calculado sobre o dado de hoje."
      />

      <div className={estilos.layout}>
        <ListaSalvos relatorios={salvos} selecionadoId={salvo.id} />
        <div className={estilos.coluna}>
          <Construtor
            tipo={tipo}
            config={config}
            funis={funis}
            agrupamentos={agrupamentos}
            salvo={{ id: salvo.id, nome: salvo.nome }}
          />
          <Resultado resultado={resultado} />
        </div>
      </div>
    </div>
  )
}
