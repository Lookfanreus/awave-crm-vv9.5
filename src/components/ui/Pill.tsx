import estilos from './Pill.module.css'


export type PillVariante = 'ok' | 'aviso' | 'erro' | 'neutro' | 'accent'


export default function Pill({
  children,
  variante = 'neutro',
  ponto = true,
  titulo,
}: {
  children: React.ReactNode
  variante?: PillVariante
  ponto?: boolean
  
  titulo?: string
}) {
  return (
    <span className={`${estilos.pill} ${estilos[variante]}`} title={titulo}>
      {ponto ? <span className={estilos.ponto} aria-hidden /> : null}
      {children}
    </span>
  )
}
