import Importador from './Importador'
import estilos from './importar.module.css'
import VoltarConfig from '../VoltarConfig'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Importar') }
}


export default function ImportarPage() {
  return (
    <div className={estilos.pagina}>
      {}
      <CabecalhoPagina
        acima={<VoltarConfig />}
        titulo="Importar planilha"
        subtitulo="Traga seus contatos, empresas ou negócios de um arquivo CSV. Você escolhe o que cada coluna significa e vê uma prévia antes de qualquer coisa ser gravada."
      />
      <Importador />
    </div>
  )
}
