import { listarFunis, carregarFunil } from '@/server/crm/funis'
import GestorFunis from './GestorFunis'
import EditorEtapas from './EditorEtapas'
import estilos from './funis.module.css'
import VoltarConfig from '../VoltarConfig'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Funis') }
}


export default async function FunisPage({ searchParams }: { searchParams: Promise<{ funil?: string }> }) {
  const funis = await listarFunis()
  const padrao = funis.find((f) => f.is_padrao) ?? funis[0]
  const sp = await searchParams
  const pedido = sp.funil ?? padrao?.id
  
  let detalhe = pedido ? await carregarFunil(pedido) : null
  if (!detalhe && padrao) detalhe = await carregarFunil(padrao.id)

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        acima={<VoltarConfig />}
        titulo="Funis"
        subtitulo="Crie funis de venda, edite as etapas e escolha qual é o padrão."
      />
      <div className={estilos.layout}>
        <GestorFunis funis={funis} selecionadoId={detalhe?.id ?? null} />
        {detalhe && <EditorEtapas funil={detalhe} />}
      </div>
    </div>
  )
}
