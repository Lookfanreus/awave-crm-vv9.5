import { notFound } from 'next/navigation'
import { normalizarSlug, ehModuloAusente } from '@/lib/zona-custom'



export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const caminho = normalizarSlug(slug)
  if (!caminho) return {}
  try {
    const mod = await import(/* turbopackOptional: true */ `@custom/paginas/${caminho}/pagina.tsx`)
    const titulo = (mod as { meta?: { titulo?: unknown } }).meta?.titulo
    if (typeof titulo !== 'string' || titulo.trim().length === 0) return {}
    
    
    const { tituloDaPagina } = await import('@/server/marca')
    return { title: await tituloDaPagina(titulo.trim()) }
  } catch {
    return {}
  }
}

export default async function PaginaCustom({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params

  
  const caminho = normalizarSlug(slug)
  if (!caminho) notFound()

  let mod: { default?: unknown }
  try {
    
    
    
    mod = await import(/* turbopackOptional: true */ `@custom/paginas/${caminho}/pagina.tsx`)
  } catch (err) {
    
    
    if (ehModuloAusente(err)) notFound()
    throw err
  }

  const Componente = mod.default
  if (typeof Componente !== 'function') notFound()

  const Render = Componente as React.ComponentType
  return <Render />
}
