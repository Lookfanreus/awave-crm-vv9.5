import Link from 'next/link'


export default function BarraDeAbas<T extends string>({
  abas,
  ativa,
  rotulo,
  href,
  rotuloDaAba,
  classes,
}: {
  abas: T[]
  ativa: T
  
  rotulo: string
  href: (aba: T) => string
  rotuloDaAba: (aba: T) => string
  classes: { barra: string; aba: string; ativa: string }
}) {
  
  if (abas.length < 2) return null

  return (
    <nav className={classes.barra} aria-label={rotulo}>
      {abas.map((aba) => (
        <Link
          key={aba}
          href={href(aba)}
          className={aba === ativa ? classes.ativa : classes.aba}
          
          
          
          aria-current={aba === ativa ? 'page' : undefined}
        >
          {rotuloDaAba(aba)}
        </Link>
      ))}
    </nav>
  )
}
