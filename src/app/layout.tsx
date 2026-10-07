import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { lerMarca, cssDaMarca } from '@/server/marca'
import { temaDaRequisicao } from '@/server/tema'
import { atributoTema } from '@/lib/tema'


const geist = localFont({
  src: '../fontes/Geist-Variable.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-sans',
})


export async function generateMetadata(): Promise<Metadata> {
  const { nome, favicon } = await lerMarca()
  return {
    title: nome,
    description: 'CRM self-host da linha Awave.',
    
    
    ...(favicon ? { icons: { icon: favicon } } : {}),
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const marca = await lerMarca()
  const css = cssDaMarca(marca)
  const tema = await temaDaRequisicao()

  return (
    
    
    
    
    
    
    
    <html lang="pt-BR" className={geist.variable} data-tema={atributoTema(tema)}>
      <head>
        {}
        {css ? <style>{css}</style> : null}
      </head>
      <body>{children}</body>
    </html>
  )
}
