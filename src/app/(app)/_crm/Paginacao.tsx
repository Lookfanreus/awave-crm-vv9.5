import { ChevronLeft, ChevronRight } from 'lucide-react'
import Botao from '@/components/ui/Botao'
import estilos from './crm.module.css'


function href(base: string, busca: string, p: number): string {
  const params = new URLSearchParams()
  if (busca) params.set('busca', busca)
  if (p > 0) params.set('p', String(p))
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}


export default function Paginacao({
  base,
  busca,
  p,
  temMais,
}: {
  base: string
  busca: string
  p: number
  temMais: boolean
}) {
  const temAnterior = p > 0
  if (!temAnterior && !temMais) return null

  return (
    <div className={estilos.paginacao}>
      <span className={estilos.paginacaoInfo}>Página {p + 1}</span>
      {}
      <div className={estilos.paginacaoBtns}>
        {temAnterior ? (
          <Botao href={href(base, busca, p - 1)}>
            <ChevronLeft size={15} /> Anterior
          </Botao>
        ) : (
          <Botao type="button" desabilitado>
            <ChevronLeft size={15} /> Anterior
          </Botao>
        )}
        {temMais ? (
          <Botao href={href(base, busca, p + 1)}>
            Próxima <ChevronRight size={15} />
          </Botao>
        ) : (
          <Botao type="button" desabilitado>
            Próxima <ChevronRight size={15} />
          </Botao>
        )}
      </div>
    </div>
  )
}
