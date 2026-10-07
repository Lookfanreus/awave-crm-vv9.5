'use client'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { MoreVertical, Lock } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { PAPEL_ARRASTAVEL } from '@/lib/anuncios-de-arraste'
import type { CartaoNegocio } from '@/server/crm/kanban'
import { moedaBRL } from '@/lib/formato'
import {
  variantePrevisao,
  rotuloPrevisaoCartao,
  dataPrevisaoBR,
  mostrarPrevisaoNoCartao,
} from '@/lib/previsao'
import Pill, { type PillVariante } from '@/components/ui/Pill'
import Avatar from '@/components/ui/Avatar'
import MenuCartao from './MenuCartao'
import mov from '@/app/movimento.module.css'
import estilos from './kanban.module.css'


export type EtapaDoCartao = { cor: string | null; nome: string }


const VARIANTE_SLA: Record<string, PillVariante> = {
  ok: 'neutro',
  atencao: 'aviso',
  estourado: 'erro',
}


export function CartaoView({ cartao, sombra = false, menu, etapa, responsavelNome }: {
  cartao: CartaoNegocio
  sombra?: boolean
  menu?: React.ReactNode
  etapa?: EtapaDoCartao
  
  responsavelNome?: string | null
}) {
  const quem = cartao.contatoNome ?? cartao.empresaNome
  const dias = cartao.diasAtePrevisao
  const temSinais =
    cartao.agenda !== 'sem' || dias != null || cartao.sla !== 'sem' || cartao.travado

  return (
    <div className={`${estilos.cartao} ${sombra ? estilos.cartaoArrastando : ''}`}>
      <div className={estilos.cartaoTopo}>
        {}
        {}
        {etapa && (
          <span
            className={estilos.pontoEtapa}
            style={{ background: etapa.cor ?? 'var(--acento)' }}
            title={etapa.nome}
            aria-hidden
          />
        )}
        <b className={estilos.cartaoTitulo}>{cartao.titulo}</b>

        {}
        {responsavelNome && (
          <Avatar nome={responsavelNome} tamanho="sm" rotulo={`Responsável: ${responsavelNome}`} />
        )}

        {menu ?? (
          <button type="button" className={estilos.kebab} aria-label="Ações" onPointerDown={(e) => e.stopPropagation()}>
            <MoreVertical size={16} />
          </button>
        )}
      </div>

      {temSinais && (
        <div className={estilos.cartaoSinais}>
          {}
          {cartao.agenda === 'atrasada' && <Pill variante="erro">Atividade atrasada</Pill>}
          {cartao.agenda === 'planejada' && (
            <span
              className={estilos.pontoAgenda}
              title="Atividade planejada"
              aria-label="Atividade planejada"
              role="img"
            />
          )}

          {}
          {dias != null && mostrarPrevisaoNoCartao(dias) && (
            <Pill
              variante={variantePrevisao(dias)}
              ponto={false}
              titulo={`Previsão de fechamento: ${dataPrevisaoBR(cartao.previsao!)}`}
            >
              {rotuloPrevisaoCartao(dias)}
            </Pill>
          )}

          {cartao.sla !== 'sem' && (
            <Pill
              variante={VARIANTE_SLA[cartao.sla] ?? 'neutro'}
              ponto={false}
              titulo={`${cartao.diasNaEtapa} dia(s) nesta etapa`}
            >
              {cartao.diasNaEtapa}d
            </Pill>
          )}

          {cartao.travado && (
            <Pill
              variante="aviso"
              ponto={false}
              titulo="Campos obrigatórios em falta — o negócio não avança"
            >
              <Lock size={12} strokeWidth={2} aria-hidden />
            </Pill>
          )}
        </div>
      )}

      {}
      {(quem || cartao.valor != null) && (
        <div className={estilos.cartaoRodape}>
          {quem && <Avatar nome={quem} tamanho="sm" />}
          {quem && <span className={estilos.cartaoSub}>{quem}</span>}
          {cartao.valor != null && <span className={estilos.cartaoValor}>{moedaBRL(cartao.valor)}</span>}
        </div>
      )}
    </div>
  )
}


export default function Cartao({ cartao, onRemover, onErro, indice, entrando, arrastavel = true, responsavelNome }: {
  cartao: CartaoNegocio
  onRemover: (id: string) => () => void
  onErro: (msg: string) => void
  indice: number
  
  entrando: boolean
  
  arrastavel?: boolean
  responsavelNome?: string | null
}) {
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cartao.id, disabled: !arrastavel, attributes: { roleDescription: PAPEL_ARRASTAVEL } })
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link
        href={`/negocios/${cartao.id}`}
        className={entrando ? `${mov.entra} ${mov.escalona}` : undefined}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block', '--i': indice } as CSSProperties}
        tabIndex={-1}
      >
        <CartaoView
          cartao={cartao}
          responsavelNome={responsavelNome}
          menu={<MenuCartao cartaoId={cartao.id} onRemover={onRemover} onErro={onErro} />}
        />
      </Link>
    </div>
  )
}
