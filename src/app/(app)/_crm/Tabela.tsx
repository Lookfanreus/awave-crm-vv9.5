import Link from 'next/link'
import estilos from './crm.module.css'

export type ColunaTabela = { chave: string; rotulo: string }
export type LinhaTabela = { id: string; href: string; celulas: React.ReactNode[] }


export default function Tabela({
  colunas,
  linhas,
  vazio,
}: {
  colunas: ColunaTabela[]
  linhas: LinhaTabela[]
  vazio: React.ReactNode
}) {
  if (linhas.length === 0) return <>{vazio}</>

  const estiloGrid = {
    gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))`,
  } as React.CSSProperties

  return (
    <div className={estilos.tabela}>
      <div className={estilos.tabelaCabecalho} style={estiloGrid}>
        {colunas.map((c) => (
          <span key={c.chave}>{c.rotulo}</span>
        ))}
      </div>
      {linhas.map((l) => (
        <Link key={l.id} href={l.href} className={estilos.tabelaLinha} style={estiloGrid}>
          {l.celulas.map((cel, i) => (
            <span key={i} className={estilos.tabelaCelula}>{cel}</span>
          ))}
        </Link>
      ))}
    </div>
  )
}
