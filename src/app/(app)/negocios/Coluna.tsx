'use client'
import { useState, useTransition, type CSSProperties } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Inbox } from 'lucide-react'
import type { ColunaBoard, CartaoNegocio } from '@/server/crm/kanban'
import { moedaBRL } from '@/lib/formato'
import { vazioDaColuna } from '@/lib/busca-board'
import { criarRapido } from './actions'
import Cartao from './Cartao'
import EstadoVazio from '@/components/ui/EstadoVazio'
import mov from '@/app/movimento.module.css'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './kanban.module.css'

export default function Coluna({ coluna, onCriar, onRemover, onErro, indice, entrando, alvo, filtrando = false, porResponsavel = false, temBusca = false, nomePorMembro }: {
  coluna: ColunaBoard
  onCriar: (etapaId: string, cartao: CartaoNegocio) => void
  onRemover: (id: string) => () => void
  onErro: (msg: string) => void
  
  indice: number
  
  entrando: boolean
  
  alvo: boolean
  
  filtrando?: boolean
  
  porResponsavel?: boolean
  temBusca?: boolean
  
  nomePorMembro: Map<string, string>
}) {
  
  
  const cor = coluna.cor ?? 'var(--acento)'
  const ids = coluna.cartoes.map((c) => c.id)
  const { setNodeRef } = useDroppable({ id: coluna.etapaId })
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [pendente, iniciar] = useTransition()

  
  function submeter() {
    if (pendente) return
    const t = titulo.trim()
    if (!t) { setCriando(false); setTitulo(''); return }
    iniciar(async () => {
      const r = await criarRapido({ etapaId: coluna.etapaId, titulo: t })
      if ('erro' in r) onErro('Não foi possível criar. Tente de novo.')
      else onCriar(coluna.etapaId, {
        ...r.cartao,
        contatoNome: null,
        empresaNome: null,
        agenda: 'sem',
        
        previsao: null,
        diasAtePrevisao: null,
      })
      
      
      setTitulo(''); setCriando(false)
    })
  }

  return (
    <section
      className={`${estilos.coluna}${entrando ? ` ${mov.entra} ${mov.escalona}` : ''}`}
      style={{ '--i': indice } as CSSProperties}
    >
      {}
      <header className={estilos.colunaHead}>
        <div className={estilos.colunaLinha}>
          <b className={estilos.colunaNome}>{coluna.nome}</b>
          <span className={estilos.colunaCount}>{coluna.total}</span>
          {coluna.atrasados > 0 && (
            <span className={estilos.atrasados}>
              {coluna.atrasados} atrasado{coluna.atrasados > 1 ? 's' : ''}
            </span>
          )}
          <span className={estilos.colunaSoma}>{moedaBRL(coluna.somaValor)}</span>
        </div>
        <span className={estilos.colunaBarra} style={{ background: cor }} aria-hidden />
      </header>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {}
        <div
          ref={setNodeRef}
          className={`${estilos.colunaCorpo}${alvo ? ` ${estilos.colunaCorpoSobre}` : ''}`}
        >
          {coluna.cartoes.length === 0 && !criando
            ? (
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              <EstadoVazio
                icone={<Inbox size={20} strokeWidth={1.75} />}
                {...vazioDaColuna(filtrando, porResponsavel, temBusca)}
              />
            )
            : coluna.cartoes.map((c, i) => (
              <Cartao
                key={c.id}
                cartao={c}
                indice={i}
                entrando={entrando}
                arrastavel={!filtrando}
                responsavelNome={c.responsavelId ? nomePorMembro.get(c.responsavelId) ?? null : null}
                onRemover={onRemover}
                onErro={onErro}
              />
            ))}

          {criando ? (
            
            <Entrada autoFocus className={estilos.quickInput} placeholder="Título do negócio"
              value={titulo} onChange={(e) => setTitulo(e.target.value)}
              onBlur={() => submeter()}
              onKeyDown={(e) => { if (e.key === 'Enter') submeter(); if (e.key === 'Escape') { setTitulo(''); setCriando(false) } }}
              disabled={pendente} />
          ) : filtrando ? null : (
            <Botao variante="fantasma" larguraTotal className={estilos.adicionar} type="button" onClick={() => setCriando(true)}>
              <Plus size={16} /> Adicionar
            </Botao>
          )}
        </div>
      </SortableContext>
    </section>
  )
}
