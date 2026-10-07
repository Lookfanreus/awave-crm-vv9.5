import type { ItemAgenda } from '@/server/crm/agenda-consulta'
import LinhaAgenda from './LinhaAgenda'
import estilos from './agenda.module.css'


export default function SecaoAgenda({
  titulo,
  itens,
  atraso,
  deslocamento = 0,
}: {
  titulo: string
  itens: ItemAgenda[]
  atraso?: boolean
  deslocamento?: number
}) {
  if (itens.length === 0) return null
  return (
    <section className={estilos.secao}>
      <h2 className={estilos.secaoTitulo}>
        {titulo}
        <span className={atraso ? estilos.contagemAtraso : estilos.contagem}>{itens.length}</span>
      </h2>
      <ul className={estilos.lista}>
        {itens.map((it, i) => (
          <LinhaAgenda key={it.id} item={it} atrasada={atraso} indice={deslocamento + i} />
        ))}
      </ul>
    </section>
  )
}
