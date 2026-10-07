import type { CSSProperties } from 'react'
import type { EtapaMetrica } from '@/server/crm/metricas'
import { corDaRampa } from '@/lib/rampa'
import { comprimentoBarra } from '@/lib/barra-grafico'
import { moedaBRL } from '@/lib/formato'
import mov from '@/app/movimento.module.css'
import estilos from './painel.module.css'




export default function GraficoEtapas({ etapas }: { etapas: EtapaMetrica[] }) {
  
  
  const maiorValor = Math.max(1, ...etapas.map((e) => e.valor))

  return (
    
    
    
    <ul className={estilos.funil}>
      {etapas.map((e, i) => {
        const largura = comprimentoBarra(e.valor, maiorValor)

        return (
          <li key={e.etapaId} className={estilos.linhaEtapa}>
            <span className={estilos.nomeEtapa}>
              <span
                className={estilos.ponto}
                style={{ background: e.cor ?? 'var(--acento)' }}
                aria-hidden
              />
              <span className={estilos.rotuloEtapa} title={e.nome}>
                {e.nome}
              </span>
            </span>

            {}
            <span className={estilos.trilhoEtapa} aria-hidden>
              <span
                className={`${estilos.barraEtapa} ${mov.cresce} ${mov.escalona}`}
                style={{ width: `${largura}%`, background: corDaRampa(i, etapas.length), '--i': i } as CSSProperties}
              />
            </span>

            <span className={estilos.valorEtapa}>{e.valor > 0 ? moedaBRL(e.valor) : '—'}</span>
            <span className={estilos.qtdEtapa}>{e.count} neg.</span>
          </li>
        )
      })}
    </ul>
  )
}
