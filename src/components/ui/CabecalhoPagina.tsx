import estilos from './CabecalhoPagina.module.css'


export default function CabecalhoPagina({
  titulo, subtitulo, acoes, acima,
}: {
  titulo: React.ReactNode
  subtitulo?: React.ReactNode
  acoes?: React.ReactNode
  acima?: React.ReactNode
}) {
  return (
    <header className={estilos.cabecalho}>
      {acima}
      <div className={estilos.linha}>
        <div className={estilos.textos}>
          <h1 className={estilos.titulo}>{titulo}</h1>
          {subtitulo ? <p className={estilos.sub}>{subtitulo}</p> : null}
        </div>
        {acoes ? <div className={estilos.acoes}>{acoes}</div> : null}
      </div>
    </header>
  )
}
