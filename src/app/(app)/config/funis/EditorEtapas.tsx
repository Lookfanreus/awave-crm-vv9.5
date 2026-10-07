'use client'
import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { GripVertical, Plus } from 'lucide-react'
import {
  criarEtapa, renomearEtapa, recolorirEtapa, reordenarEtapas, excluirEtapa, definirSla,
  definirProbabilidade, type FunilDetalhe, type EtapaEditor,
} from '@/server/crm/funis'
import { PALETA_ETAPAS, nomeDaCor } from '@/lib/cores-etapa'
import { anunciosDeArraste, INSTRUCAO_DE_ARRASTE, PAPEL_ARRASTAVEL } from '@/lib/anuncios-de-arraste'
import { usarPopup } from '@/components/ui/usar-popup'
import Botao from '@/components/ui/Botao'
import { Entrada, Selecao } from '@/components/ui/Campo'
import estilos from './funis.module.css'

const ERRO_PT: Record<string, string> = {
  nome_vazio: 'Dê um nome à etapa.',
  nao_encontrada: 'Etapa não encontrada.',
  funil_nao_encontrado: 'Funil não encontrado.',
  ultima_etapa: 'Um funil precisa de ao menos uma etapa.',
  precisa_destino: 'Escolha para qual etapa mover os negócios.',
  destino_invalido: 'Etapa de destino inválida.',
  cor_invalida: 'Cor inválida.',
  sla_invalido: 'O prazo precisa ser um número de dias maior que zero.',
  probabilidade_invalida: 'A probabilidade precisa estar entre 0 e 100.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
}
function traduz(e: string) { return ERRO_PT[e] ?? 'Não foi possível concluir. Tente novamente.' }


export default function EditorEtapas({ funil }: { funil: FunilDetalhe }) {
  const router = useRouter()
  const [etapas, setEtapas] = useState<EtapaEditor[]>(funil.etapas)
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const [etapasDoServidor, setEtapasDoServidor] = useState(funil.etapas)
  if (etapasDoServidor !== funil.etapas) { setEtapasDoServidor(funil.etapas); setEtapas(funil.etapas) }

  function roda(fn: () => Promise<{ ok: true } | { ok: true; id: string } | { erro: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if ('erro' in r) setErro(traduz(r.erro))
      else router.refresh()
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const antigo = etapas
    const de = etapas.findIndex((x) => x.id === active.id)
    const para = etapas.findIndex((x) => x.id === over.id)
    if (de < 0 || para < 0) return
    const reordenado = [...etapas]
    const [movido] = reordenado.splice(de, 1)
    reordenado.splice(para, 0, movido)
    setEtapas(reordenado) 
    setErro(null)
    const r = await reordenarEtapas({ funilId: funil.id, ordemIds: reordenado.map((x) => x.id) })
    if ('erro' in r) { setEtapas(antigo); setErro(traduz(r.erro)) }
    else router.refresh()
  }

  function adicionar() {
    if (!novo.trim()) return
    roda(async () => {
      const r = await criarEtapa({ funilId: funil.id, nome: novo })
      if ('ok' in r) setNovo('')
      return r
    })
  }

  return (
    <section className={estilos.editor}>
      <h2 className={estilos.subtitulo}>Etapas de {funil.nome}</h2>
      <p className={estilos.ajuda}>Arraste para reordenar. Clique na cor para trocar.</p>
      {erro && <p className={estilos.erro}>{erro}</p>}

      {}
      <div className={estilos.etapaCabecalho} aria-hidden>
        <span className={estilos.colEtapa}>Etapa</span>
        <span className={estilos.colNum}>Negócios</span>
        <span className={estilos.colCampo}>Chance %</span>
        <span className={estilos.colCampo}>Prazo</span>
        <span className={estilos.colAcoes} />
      </div>

      {}
      {}
      <DndContext
        id="funis-etapas"
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements: anunciosDeArraste((id) => etapas.find((e) => e.id === id)?.nome ?? ''),
          screenReaderInstructions: { draggable: INSTRUCAO_DE_ARRASTE },
        }}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={etapas.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className={estilos.etapaLista}>
            {etapas.map((etapa) => (
              <LinhaEtapa key={etapa.id} etapa={etapa} etapas={etapas} podeExcluir={etapas.length > 1} pendente={pendente} roda={roda} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <p className={estilos.legenda}>
        <strong>Chance %</strong> é a probabilidade de um negócio nesta etapa ser fechado. É o que
        alimenta a <strong>Previsão de fechamento</strong> em Relatórios — etapa sem chance
        preenchida fica de fora da previsão. <strong>Prazo</strong> é quantos dias um negócio pode
        ficar parado aqui antes de ser sinalizado. Deixe vazio para não usar.
      </p>

      <div className={estilos.novoRow}>
        <Entrada value={novo} placeholder="Nova etapa (ex.: Qualificação)"
          onChange={(e) => setNovo(e.target.value)} disabled={pendente}
          onKeyDown={(e) => { if (e.key === 'Enter') adicionar() }} />
        <Botao variante="primario" type="button" carregando={pendente} desabilitado={!novo.trim()} onClick={adicionar}>
          <Plus size={15} /> Adicionar etapa
        </Botao>
      </div>
    </section>
  )
}

function LinhaEtapa({ etapa, etapas, podeExcluir, pendente, roda }: {
  etapa: EtapaEditor; etapas: EtapaEditor[]; podeExcluir: boolean; pendente: boolean
  roda: (fn: () => Promise<{ ok: true } | { ok: true; id: string } | { erro: string }>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id, attributes: { roleDescription: PAPEL_ARRASTAVEL } })
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(etapa.nome)
  const [paletaAberta, setPaletaAberta] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [destino, setDestino] = useState('')
  const paletaRef = useRef<HTMLDivElement>(null)
  
  
  
  const menuRef = usarPopup({ aberto: paletaAberta, fechar: () => setPaletaAberta(false) })

  
  useEffect(() => {
    if (!paletaAberta) return
    function fora(e: MouseEvent) {
      if (paletaRef.current && !paletaRef.current.contains(e.target as Node)) setPaletaAberta(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [paletaAberta])

  function salvar() { roda(() => renomearEtapa({ id: etapa.id, nome })); setEditando(false) }
  function trocarCor(cor: string) { setPaletaAberta(false); roda(() => recolorirEtapa({ id: etapa.id, cor })) }

  const outras = etapas.filter((e) => e.id !== etapa.id)
  function pedirExcluir() {
    if (etapa.totalNegocios > 0) { setDestino(outras[0]?.id ?? ''); setExcluindo(true) }
    else roda(() => excluirEtapa({ id: etapa.id }))
  }
  function confirmarExcluir() {
    if (!destino) return
    roda(() => excluirEtapa({ id: etapa.id, destinoId: destino }))
    setExcluindo(false)
  }

  const tituloExcluir = !podeExcluir ? 'Um funil precisa de ao menos uma etapa.' : 'Excluir etapa'

  return (
    <li ref={setNodeRef} style={style} className={estilos.etapaItem}>
      <div className={estilos.etapaLinha}>
        <button type="button" className={estilos.grip} aria-label="Arrastar para reordenar" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>

        <div className={estilos.swatchWrap} ref={paletaRef}>
          {}
          {}
          <button type="button" className={estilos.swatch} disabled={pendente}
            style={{ background: etapa.cor ?? 'var(--trilho)', borderColor: etapa.cor ?? 'var(--linha-forte)' }}
            title="Trocar cor"
            aria-label={etapa.cor ? `Trocar cor da etapa ${etapa.nome} (atual: ${nomeDaCor(etapa.cor)})` : `Escolher cor da etapa ${etapa.nome}`}
            aria-expanded={paletaAberta}
            onClick={() => setPaletaAberta((v) => !v)} />
          {paletaAberta && (
            
            
            
            <div className={estilos.paleta} ref={menuRef}>
              {PALETA_ETAPAS.map((c) => (
                <button key={c} type="button"
                  
                  
                  aria-label={nomeDaCor(c)}
                  aria-current={etapa.cor === c ? 'true' : undefined}
                  className={`${estilos.corBtn} ${etapa.cor === c ? estilos.corBtnAtiva : ''}`}
                  style={{ background: c }} title={nomeDaCor(c)} onClick={() => trocarCor(c)} />
              ))}
            </div>
          )}
        </div>

        {editando ? (
          <Entrada value={nome} autoFocus
            onChange={(e) => setNome(e.target.value)} disabled={pendente}
            onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false) }} />
        ) : (
          <span className={estilos.etapaNome}>{etapa.nome}</span>
        )}
        <span className={estilos.etapaCount}>{etapa.totalNegocios}</span>

        {}
        <span className={estilos.campoCurto}>
          <Entrada type="number" min="0" max="100" step="1"
            defaultValue={etapa.probabilidade ?? ''} placeholder="—" disabled={pendente}
            aria-label={`Chance de fechamento em % da etapa ${etapa.nome}`}
            title="Chance de fechar um negócio nesta etapa, de 0 a 100 (vazio = fora da previsão)"
            onBlur={(e) => {
              const v = e.target.value.trim()
              const valor = v === '' ? null : Number(v)
              if (valor === (etapa.probabilidade ?? null)) return   
              roda(() => definirProbabilidade({ id: etapa.id, valor }))
            }} />
          <span className={estilos.sufixo} aria-hidden>%</span>
        </span>

        {}
        <span className={estilos.campoCurto}>
          <Entrada type="number" min="1"
            defaultValue={etapa.sla_dias ?? ''} placeholder="—" disabled={pendente}
            aria-label={`Prazo em dias da etapa ${etapa.nome}`}
            title="Prazo em dias nesta etapa (vazio = sem prazo)"
            onBlur={(e) => {
              const v = e.target.value.trim()
              const dias = v === '' ? null : Number(v)
              if (dias === (etapa.sla_dias ?? null)) return   
              roda(() => definirSla({ id: etapa.id, dias }))
            }} />
          <span className={estilos.sufixo} aria-hidden>d</span>
        </span>

        <span className={estilos.etapaAcoes}>
          {editando
            ? <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={salvar}>Salvar</Botao>
            : <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={() => { setNome(etapa.nome); setEditando(true) }}>Renomear</Botao>}
          <Botao variante="fantasma" tamanho="pequeno" tom="erro" type="button" carregando={pendente} desabilitado={!podeExcluir} title={tituloExcluir} onClick={pedirExcluir}>Excluir</Botao>
        </span>
      </div>

      {excluindo && (
        <div className={estilos.mover}>
          <label className={estilos.moverLabel}>
            Mover {etapa.totalNegocios} negócio(s) para:
            <Selecao value={destino} onChange={(e) => setDestino(e.target.value)} disabled={pendente}>
              {outras.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Selecao>
          </label>
          <Botao variante="primario" type="button" carregando={pendente} desabilitado={!destino} onClick={confirmarExcluir}>
            Mover e excluir
          </Botao>
          <Botao type="button" carregando={pendente} onClick={() => setExcluindo(false)}>Cancelar</Botao>
        </div>
      )}
    </li>
  )
}
