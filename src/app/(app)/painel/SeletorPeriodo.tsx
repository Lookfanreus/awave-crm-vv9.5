import Link from 'next/link'
import type { PeriodoDias } from '@/server/crm/metricas'
import estilos from './painel.module.css'

const OPCOES: { dias: PeriodoDias; rotulo: string }[] = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
]


export default function SeletorPeriodo({ atual }: { atual: PeriodoDias }) {
  return (
    <div className={estilos.periodo} role="group" aria-label="Período do painel">
      {OPCOES.map((o) => (
        <Link
          key={o.dias}
          href={`/painel?periodo=${o.dias}`}
          className={o.dias === atual ? estilos.periodoAtivo : estilos.periodoItem}
          aria-current={o.dias === atual ? 'true' : undefined}
        >
          {o.rotulo}
        </Link>
      ))}
    </div>
  )
}
