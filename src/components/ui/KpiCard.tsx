import Delta from './Delta'
import Sparkline from './Sparkline'
import estilos from './KpiCard.module.css'


export default function KpiCard({
  label,
  valor,
  delta,
  nota,
  serie,
  cor,
  semSerie,
  semSerieDetalhe,
}: {
  label: string
  valor: string
  
  delta?: { valor: number; rotulo?: string; unidade?: 'pct' | 'pp' }
  
  nota?: string
  
  serie?: (number | null)[] | null
  
  cor?: string
  
  semSerie?: string
  
  semSerieDetalhe?: string
}) {
  return (
    <div className={estilos.bloco}>
      <div className={estilos.label}>{label}</div>
      <div className={estilos.valor}>{valor}</div>
      <div className={estilos.rodape}>
        {delta ? (
          <Delta valor={delta.valor} rotulo={delta.rotulo} unidade={delta.unidade} />
        ) : nota ? (
          <span className={estilos.nota}>{nota}</span>
        ) : null}
      </div>
      {semSerie != null && (
        <Sparkline
          serie={serie ?? null}
          cor={cor ?? 'var(--acento)'}
          motivo={semSerie}
          detalhe={semSerieDetalhe}
        />
      )}
    </div>
  )
}
