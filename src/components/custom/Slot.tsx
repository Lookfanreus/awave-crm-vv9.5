import { Suspense } from 'react'
import { ehSegmentoValido, ehModuloAusente } from '@/lib/zona-custom'
import LimiteDeErro from './LimiteDeErro'
import { detalheSeguro } from '@/lib/sanitizar-erro'



export const ANCORAS = [
  'negocio.detalhe.lateral',
  'contato.detalhe.rodape',
  'empresa.detalhe.rodape',
  'painel.topo',
] as const

export type Ancora = (typeof ANCORAS)[number]

type Bloco = React.ComponentType<{ ctx?: Record<string, string> }>


export async function componenteDaAncora(
  ancora: string,
  carregar: (a: string) => Promise<{ default?: unknown }> = carregarDoDisco,
): Promise<Bloco | null> {
  
  
  
  
  if (!ancora.split('.').every(ehSegmentoValido)) return null

  let mod: { default?: unknown }
  try {
    mod = await carregar(ancora)
  } catch (err) {
    
    
    if (ehModuloAusente(err)) return null
    
    
    console.error('[custom/slot] falhou ao carregar:', ancora, detalheSeguro(err))
    return null
  }

  const Componente = mod?.default
  if (typeof Componente !== 'function') return null
  return Componente as Bloco
}

function carregarDoDisco(ancora: string): Promise<{ default?: unknown }> {
  
  
  
  return import(/* turbopackOptional: true */ `@custom/slots/${ancora}.tsx`)
}


export function embrulharSlot(ancora: string, Render: Bloco, ctx?: Record<string, string>) {
  return (
    <Suspense fallback={null}>
      <LimiteDeErro ancora={ancora}>
        <Render ctx={ctx} />
      </LimiteDeErro>
    </Suspense>
  )
}

export default async function Slot({
  ancora,
  ctx,
}: {
  ancora: Ancora
  ctx?: Record<string, string>
}) {
  const Render = await componenteDaAncora(ancora)
  if (!Render) return null
  return embrulharSlot(ancora, Render, ctx)
}
