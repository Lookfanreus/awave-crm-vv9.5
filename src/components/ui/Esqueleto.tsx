import mov from '@/app/movimento.module.css'
import estilos from './Esqueleto.module.css'


export default function Esqueleto({
  largura = '100%',
  altura = '11px',
  redondo = false,
}: {
  
  largura?: string
  altura?: string
  
  redondo?: boolean
}) {
  return (
    <span
      className={`${mov.pulsa} ${estilos.bloco}${redondo ? ` ${estilos.redondo}` : ''}`}
      style={{ width: largura, height: altura }}
      aria-hidden
    />
  )
}
