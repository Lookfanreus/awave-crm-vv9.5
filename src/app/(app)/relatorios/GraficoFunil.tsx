import type { CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { comprimentoBarra } from '@/lib/barra-grafico'
import { corDaRampa } from '@/lib/rampa'
import type { LinhaConversao } from '@/lib/relatorios'
import mov from '@/app/movimento.module.css'
import estilos from './relatorios.module.css'


export default function GraficoFunil({ linhas }: { linhas: LinhaConversao[] }) {
  const maior = linhas.reduce((m, l) => Math.max(m, l.entraram), 0)

  return (
    <ol className={estilos.funil}>
      {linhas.map((l, i) => (
        <li key={l.etapa_id} className={estilos.funilEtapa}>
          <span className={estilos.funilNome} title={l.nome}>{l.nome}</span>

          {}
          <span className={estilos.trilho} aria-hidden>
            <span
              className={`${estilos.barra} ${mov.cresce} ${mov.escalona}`}
              style={{
                width: `${comprimentoBarra(l.entraram, maior)}%`,
                background: corDaRampa(i, linhas.length),
                '--i': i,
              } as CSSProperties}
            />
          </span>

          <span className={estilos.funilValor}>{l.entraram}</span>
          {}
          <span className={estilos.funilUnidade}>neg.</span>

          {l.taxaSeguinte !== null && (
            <span className={estilos.funilQueda}>
              <ChevronDown size={14} strokeWidth={2} aria-hidden />
              <span>
                <b>{l.taxaSeguinte.toLocaleString('pt-BR')}%</b> seguiram — {l.chegaramSeguinte} de {l.entraram}
              </span>
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
