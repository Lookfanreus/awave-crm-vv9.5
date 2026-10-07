import estilos from './EstadoVazio.module.css'


export default function EstadoVazio({
  icone,
  titulo,
  texto,
  acao,
}: {
  
  icone: React.ReactNode
  titulo: string
  texto?: string
  
  acao?: React.ReactNode
}) {
  return (
    <div className={estilos.vazio}>
      <span className={estilos.tile} aria-hidden>
        {icone}
      </span>
      <b className={estilos.titulo}>{titulo}</b>
      {texto ? <p className={estilos.texto}>{texto}</p> : null}
      {acao ? <div className={estilos.acao}>{acao}</div> : null}
    </div>
  )
}
