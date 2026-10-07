'use client'
import { mensagemGate } from '@/lib/mensagem-gate'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCorners, type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import type { ColunaBoard, CartaoNegocio } from '@/server/crm/kanban'
import { aplicarDrop, type ColunasEstado, type ResultadoDrop } from '@/server/crm/kanban-ordem'
import { estadoRolagem, destinoDoPasso, type EstadoRolagem } from '@/lib/rolagem-board'
import { filtrarColunas, resumoDoRecorte } from '@/lib/busca-board'
import { anunciosDeArraste, INSTRUCAO_DE_ARRASTE } from '@/lib/anuncios-de-arraste'
import { moverNegocio } from './actions'
import Coluna from './Coluna'
import { CartaoView } from './Cartao'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './kanban.module.css'

export default function Board({ colunasIniciais, pessoas, membroAtivoId }: {
  colunasIniciais: ColunaBoard[]
  
  pessoas: { id: string; nome: string }[]
  
  membroAtivoId: string | null
}) {
  const [colunas, setColunas] = useState<ColunaBoard[]>(colunasIniciais)
  const [activeId, setActiveId] = useState<string | null>(null)
  
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  
  
  
  
  
  
  const [soMeus, setSoMeus] = useState(false)

  
  function mostrarErro(msg: string) { setToast(msg); setTimeout(() => setToast(null), 6000) }
  function adicionarCartao(etapaId: string, cartao: CartaoNegocio) {
    setColunas((cols) => cols.map((c) => {
      if (c.etapaId !== etapaId) return c
      const cartoes = [...c.cartoes, { ...cartao, etapaId }]
      return { ...c, cartoes, total: cartoes.length, somaValor: cartoes.reduce((s, x) => s + Number(x.valor ?? 0), 0) }
    }))
  }
  
  function removerCartao(id: string): () => void {
    const de = colunas.find((c) => c.cartoes.some((x) => x.id === id))
    const indice = de?.cartoes.findIndex((x) => x.id === id) ?? -1
    const cartao = indice >= 0 ? de!.cartoes[indice] : null
    const etapaId = de?.etapaId ?? null

    setColunas((cols) => cols.map((c) => {
      if (!c.cartoes.some((x) => x.id === id)) return c
      const cartoes = c.cartoes.filter((x) => x.id !== id)
      return { ...c, cartoes, total: cartoes.length, somaValor: cartoes.reduce((s, x) => s + Number(x.valor ?? 0), 0) }
    }))

    return () => {
      if (!cartao || !etapaId) return
      setColunas((cols) => cols.map((c) => {
        if (c.etapaId !== etapaId) return c
        
        if (c.cartoes.some((x) => x.id === id)) return c
        const cartoes = [...c.cartoes]
        cartoes.splice(Math.min(indice, cartoes.length), 0, cartao)
        return { ...c, cartoes, total: cartoes.length, somaValor: cartoes.reduce((s, x) => s + Number(x.valor ?? 0), 0) }
      }))
    }
  }

  
  
  
  
  
  
  
  
  
  
  const boardRef = useRef<HTMLDivElement>(null)
  const [rolagem, setRolagem] = useState<EstadoRolagem>({ esquerda: false, direita: false })
  const conferirRolagem = useCallback(() => {
    const el = boardRef.current
    if (!el) return
    setRolagem(estadoRolagem(el))
  }, [])
  useEffect(() => {
    conferirRolagem()
    window.addEventListener('resize', conferirRolagem)
    return () => window.removeEventListener('resize', conferirRolagem)
  }, [conferirRolagem, colunas.length])

  
  const rolar = useCallback((direcao: 1 | -1) => {
    const el = boardRef.current
    if (!el) return
    const primeira = el.firstElementChild as HTMLElement | null
    const calha = parseFloat(getComputedStyle(el).columnGap || '0') || 0
    const passo = primeira ? primeira.offsetWidth + calha : 0
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: destinoDoPasso(el, direcao, passo), behavior: suave ? 'smooth' : 'auto' })
  }, [])

  
  
  
  
  
  
  
  
  
  
  const [entrando, setEntrando] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setEntrando(false), 900)
    return () => clearTimeout(t)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const responsavelFiltrado = soMeus ? membroAtivoId : null
  const { colunas: visiveis, encontrados, totalGeral, filtrando, porResponsavel } = useMemo(
    () => filtrarColunas(colunas, { busca, responsavelId: responsavelFiltrado }),
    [colunas, busca, responsavelFiltrado],
  )

  
  const nomePorMembro = useMemo(
    () => new Map(pessoas.map((p) => [p.id, p.nome])),
    [pessoas],
  )

  
  
  useEffect(() => { conferirRolagem() }, [conferirRolagem, filtrando, encontrados])

  const etapaIds = useMemo(() => new Set(colunas.map((c) => c.etapaId)), [colunas])
  const cartaoPorId = useMemo(() => {
    const m = new Map<string, CartaoNegocio>()
    for (const col of colunas) for (const c of col.cartoes) m.set(c.id, c)
    return m
  }, [colunas])

  function colunaDoCartao(cartaoId: string): string | undefined {
    return colunas.find((col) => col.cartoes.some((c) => c.id === cartaoId))?.etapaId
  }

  
  function colunaDoOver(overId: string): string | undefined {
    return etapaIds.has(overId) ? overId : colunaDoCartao(overId)
  }

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)) }

  
  
  
  
  
  
  
  
  function onDragOver(e: DragOverEvent) {
    const over = e.over ? String(e.over.id) : null
    setColunaAlvo(over ? colunaDoOver(over) ?? null : null)
  }

  function onDragCancel() { setActiveId(null); setColunaAlvo(null) }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    setColunaAlvo(null)
    const { active, over } = e
    if (!over) return
    const cartaoId = String(active.id)
    const origemId = colunaDoCartao(cartaoId)
    if (!origemId) return

    const overId = String(over.id)
    let destinoId: string
    let indice: number
    if (etapaIds.has(overId)) {
      destinoId = overId
      indice = colunas.find((c) => c.etapaId === destinoId)!.cartoes.length
    } else {
      destinoId = colunaDoCartao(overId) ?? origemId
      const col = colunas.find((c) => c.etapaId === destinoId)!
      const pos = col.cartoes.findIndex((c) => c.id === overId)
      indice = pos < 0 ? col.cartoes.length : pos
    }

    if (origemId === destinoId && cartaoId === overId) return

    const idsPorColuna: ColunasEstado = Object.fromEntries(
      colunas.map((c) => [c.etapaId, c.cartoes.map((x) => x.id)]),
    )
    const resultado = aplicarDrop(idsPorColuna, { cartaoId, origemId, destinoId, indice })

    const anterior = colunas
    setColunas(reconstruir(colunas, resultado, cartaoPorId))

    const r = await moverNegocio({
      negocioId: cartaoId,
      etapaDestinoId: resultado.destinoId,
      idsDestino: resultado.idsDestino,
      etapaOrigemId: resultado.origemId,
      idsOrigem: resultado.idsOrigem,
    })
    if ('erro' in r) {
      setColunas(anterior)
      mostrarErro(mensagemGate(r.erro, r.campos, 'Não foi possível mover. Tente de novo.'))
    }
  }

  const cartaoAtivo = activeId ? cartaoPorId.get(activeId) : null
  
  
  const etapaAtiva = cartaoAtivo ? colunas.find((c) => c.etapaId === cartaoAtivo.etapaId) : null

  
  
  
  
  
  
  
  
  const nomeDoAlvo = (id: string) =>
    cartaoPorId.get(id)?.titulo ?? colunas.find((c) => c.etapaId === id)?.nome ?? ''

  
  
  return (
    <DndContext
      id="board-negocios"
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{
        announcements: anunciosDeArraste(nomeDoAlvo),
        screenReaderInstructions: { draggable: INSTRUCAO_DE_ARRASTE },
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className={estilos.buscaBarra}>
        <div className={estilos.buscaCampo}>
          <Search size={15} strokeWidth={2} className={estilos.buscaIcone} aria-hidden />
          <Entrada
            type="search"
            className={estilos.buscaInput}
            placeholder="Buscar negócio, contato ou empresa"
            aria-label="Buscar no quadro"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setBusca('') }}
          />
          {busca && (
            <Botao variante="fantasma" soIcone tamanho="pequeno" type="button" aria-label="Limpar busca"
              onClick={() => setBusca('')}>
              <X size={14} strokeWidth={2} />
            </Botao>
          )}
        </div>
        {}
        {membroAtivoId && (
          <div className={estilos.filtro}>
            <button
              type="button"
              className={soMeus ? estilos.filtroAtivo : estilos.filtroItem}
              aria-pressed={soMeus}
              onClick={() => setSoMeus(true)}
            >
              Meus
            </button>
            <button
              type="button"
              className={soMeus ? estilos.filtroItem : estilos.filtroAtivo}
              aria-pressed={!soMeus}
              onClick={() => setSoMeus(false)}
            >
              Todos
            </button>
          </div>
        )}

        {}
        {filtrando && (
          <p className={estilos.buscaContador} role="status">
            {resumoDoRecorte(encontrados, totalGeral, porResponsavel)} · arrastar e adicionar
            ficam desativados enquanto o quadro está filtrado
          </p>
        )}
      </div>

      <div
        className={
          `${estilos.boardWrap}` +
          `${rolagem.esquerda ? ` ${estilos.temEsquerda}` : ''}` +
          `${rolagem.direita ? ` ${estilos.temDireita}` : ''}` +
          `${filtrando ? ` ${estilos.semArraste}` : ''}`
        }
      >
        <div className={estilos.board} ref={boardRef} onScroll={conferirRolagem}>
          {visiveis.map((c, i) => (
            <Coluna
              key={c.etapaId}
              coluna={c}
              indice={i}
              entrando={entrando}
              alvo={colunaAlvo === c.etapaId}
              filtrando={filtrando}
              porResponsavel={porResponsavel}
              temBusca={busca.trim() !== ''}
              nomePorMembro={nomePorMembro}
              onCriar={adicionarCartao}
              onRemover={removerCartao}
              onErro={mostrarErro}
            />
          ))}
        </div>

        {}
        <button
          type="button"
          className={`${estilos.setaRolar} ${estilos.setaEsq}${rolagem.esquerda ? ` ${estilos.setaVisivel}` : ''}`}
          onClick={() => rolar(-1)}
          aria-label="Ver etapas anteriores"
          aria-hidden={!rolagem.esquerda}
          tabIndex={rolagem.esquerda ? 0 : -1}
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={`${estilos.setaRolar} ${estilos.setaDir}${rolagem.direita ? ` ${estilos.setaVisivel}` : ''}`}
          onClick={() => rolar(1)}
          aria-label="Ver próximas etapas"
          aria-hidden={!rolagem.direita}
          tabIndex={rolagem.direita ? 0 : -1}
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
      <DragOverlay>
        {cartaoAtivo ? (
          <CartaoView
            cartao={cartaoAtivo}
            sombra
            responsavelNome={nomePorMembro.get(cartaoAtivo.responsavelId ?? '') ?? null}
            etapa={etapaAtiva ? { cor: etapaAtiva.cor, nome: etapaAtiva.nome } : undefined}
          />
        ) : null}
      </DragOverlay>
      {toast && <div role="status" className={estilos.toast}>{toast}</div>}
    </DndContext>
  )
}


function reconstruir(colunas: ColunaBoard[], resultado: ResultadoDrop, mapa: Map<string, CartaoNegocio>): ColunaBoard[] {
  const novos: Record<string, string[]> = { [resultado.destinoId]: resultado.idsDestino }
  if (resultado.origemId && resultado.idsOrigem) novos[resultado.origemId] = resultado.idsOrigem
  return colunas.map((col) => {
    const ids = novos[col.etapaId]
    if (!ids) return col
    const cartoes = ids.map((id) => {
      const c = mapa.get(id)!
      return c.etapaId === col.etapaId ? c : { ...c, etapaId: col.etapaId }
    })
    return { ...col, cartoes, total: cartoes.length, somaValor: cartoes.reduce((s, c) => s + Number(c.valor ?? 0), 0) }
  })
}
