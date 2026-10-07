import estilos from './ChartCard.module.css'


export default function ChartCard({
  titulo,
  meta,
  acao,
  children,
}: {
  titulo: string
  
  meta?: React.ReactNode
  
  acao?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className={estilos.bloco}>
      <div className={estilos.header}>
        <h2 className={estilos.titulo}>{titulo}</h2>
        {meta ? <span className={estilos.meta}>{meta}</span> : null}
        {acao ? <div className={estilos.acao}>{acao}</div> : null}
      </div>
      {children}
    </section>
  )
}
