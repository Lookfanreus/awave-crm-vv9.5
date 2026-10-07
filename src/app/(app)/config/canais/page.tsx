import { headers } from 'next/headers'
import { lerPainelDeCanais } from '@/server/canais/painel'
import CanaisWhatsApp from './CanaisWhatsApp'
import estilos from '../config.module.css'
import VoltarConfig from '../VoltarConfig'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Canais') }
}


export default async function ConfigCanaisPage() {
  const painel = await lerPainelDeCanais()

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        acima={<VoltarConfig />}
        titulo="Canais"
        subtitulo="Conecte o WhatsApp e o Instagram da sua empresa pra receber e responder mensagens dentro do CRM."
      />
      <CanaisWhatsApp inicial={painel} urlSugerida={`${proto}://${host}`} />
    </div>
  )
}
