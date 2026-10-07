'use client'

import Botao from '@/components/ui/Botao'


export default function ErroCustom({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: '2rem', maxWidth: '48rem' }}>
      <h1 style={{ fontSize: '21px', fontWeight: 600, marginBottom: '0.5rem' }}>
        Erro na sua customização
      </h1>
      <p style={{ marginBottom: '1rem' }}>
        Esta página vem da sua pasta <code>custom/paginas/</code>. O restante do CRM continua
        funcionando normalmente.
      </p>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          padding: '0.75rem',
          borderRadius: '8px',
          background: 'var(--trilho)',
          color: 'var(--tinta)',
          fontSize: '13px',
        }}
      >
        {error.message}
      </pre>
      {}
      <Botao variante="primario" type="button" onClick={reset} style={{ marginTop: '1rem' }}>
        Tentar de novo
      </Botao>
    </div>
  )
}
