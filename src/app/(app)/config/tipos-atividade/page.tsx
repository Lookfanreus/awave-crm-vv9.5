import { listarTiposCompleto } from '@/server/crm/tipos'
import TiposAtividade from '../TiposAtividade'
import estilos from '../config.module.css'
import VoltarConfig from '../VoltarConfig'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Tipos de atividade') }
}


export default async function TiposAtividadePage() {
  const tipos = await listarTiposCompleto()
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        acima={<VoltarConfig />}
        titulo="Tipos de atividade"
        subtitulo="Personalize os tipos que aparecem ao registrar uma atividade. Tipos em uso podem ser arquivados; os padrão do sistema são fixos."
      />
      <TiposAtividade tipos={tipos} />
    </div>
  )
}
