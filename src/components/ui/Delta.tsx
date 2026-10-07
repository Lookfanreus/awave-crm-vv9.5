import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { textoVariacao } from '@/lib/formato'
import estilos from './Delta.module.css'


export default function Delta({
  valor,
  rotulo,
  unidade = 'pct',
}: {
  
  valor: number
  rotulo?: string
  unidade?: 'pct' | 'pp'
}) {
  const positivo = valor >= 0

  return (
    <span className={`${estilos.delta} ${positivo ? estilos.cima : estilos.baixo}`}>
      {positivo ? (
        <ArrowUpRight size={13} strokeWidth={1.75} />
      ) : (
        <ArrowDownRight size={13} strokeWidth={1.75} />
      )}
      {textoVariacao(valor, unidade)}
      {rotulo ? <span className={estilos.muted}>{rotulo}</span> : null}
    </span>
  )
}
