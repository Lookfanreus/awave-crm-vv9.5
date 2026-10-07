'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, Star } from 'lucide-react'
import { criarFunil, renomearFunil, definirPadrao, excluirFunil, type FunilResumo } from '@/server/crm/funis'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './funis.module.css'

const ERRO_PT: Record<string, string> = {
  padrao: 'O funil padrão não pode ser excluído. Torne outro padrão antes.',
  em_uso: 'Este funil tem negócios — mova ou feche antes de excluir.',
  nome_vazio: 'Dê um nome ao funil.',
  nao_encontrado: 'Funil não encontrado.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
}
function traduz(e: string) { return ERRO_PT[e] ?? 'Não foi possível concluir. Tente novamente.' }


export default function GestorFunis({ funis, selecionadoId }: { funis: FunilResumo[]; selecionadoId: string | null }) {
  const router = useRouter()
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  
  function roda(
    fn: () => Promise<{ ok: true } | { ok: true; id: string } | { erro: string }>,
    opcoes: { navegou?: boolean } = {},
  ) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if ('erro' in r) setErro(traduz(r.erro))
      else if (!opcoes.navegou) router.refresh()
    })
  }

  function adicionar() {
    if (!novo.trim()) return
    roda(async () => {
      const r = await criarFunil({ nome: novo })
      if ('ok' in r) { setNovo(''); router.push('/config/funis?funil=' + r.id) }
      return r
    }, { navegou: true })
  }

  return (
    <section className={estilos.gestor}>
      <h2 className={estilos.subtitulo}>Seus funis</h2>
      <p className={estilos.ajuda}>Selecione um funil para editar suas etapas ao lado.</p>

      <div className={estilos.novoRow}>
        <Entrada value={novo} placeholder="Novo funil (ex.: Parcerias)"
          onChange={(e) => setNovo(e.target.value)} disabled={pendente}
          onKeyDown={(e) => { if (e.key === 'Enter') adicionar() }} />
        <Botao variante="primario" type="button" carregando={pendente} desabilitado={!novo.trim()} onClick={adicionar}>
          <Plus size={15} /> Criar
        </Botao>
      </div>
      {erro && <p className={estilos.erro}>{erro}</p>}

      <ul className={estilos.lista}>
        {funis.map((f) => (
          <LinhaFunil key={f.id} funil={f} ativo={f.id === selecionadoId} pendente={pendente} roda={roda} />
        ))}
      </ul>
    </section>
  )
}

function LinhaFunil({ funil, ativo, pendente, roda }: {
  funil: FunilResumo; ativo: boolean; pendente: boolean
  roda: (fn: () => Promise<{ ok: true } | { ok: true; id: string } | { erro: string }>) => void
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(funil.nome)

  function salvar() { roda(() => renomearFunil({ id: funil.id, nome })); setEditando(false) }

  const bloqueiaExcluir = funil.is_padrao || funil.totalNegocios > 0
  const tituloExcluir = funil.is_padrao
    ? 'Funil padrão não pode ser excluído. Torne outro padrão antes.'
    : funil.totalNegocios > 0
      ? `Tem ${funil.totalNegocios} negócio(s) — mova antes de excluir.`
      : 'Excluir funil'

  return (
    <li className={`${estilos.item} ${ativo ? estilos.itemAtivo : ''}`}>
      {editando ? (
        <Entrada value={nome} autoFocus
          onChange={(e) => setNome(e.target.value)} disabled={pendente}
          onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false) }} />
      ) : (
        <button type="button" className={estilos.itemNome} onClick={() => router.push('/config/funis?funil=' + funil.id)}>
          {ativo && <Check size={14} strokeWidth={2.5} className={estilos.itemCheck} />}
          <span className={estilos.itemLabel}>{funil.nome}</span>
          {funil.is_padrao && <span className={estilos.tag}><Star size={11} strokeWidth={2} /> padrão</span>}
          <span className={estilos.itemCount}>{funil.totalNegocios}</span>
        </button>
      )}

      <span className={estilos.itemAcoes}>
        {editando
          ? <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={salvar}>Salvar</Botao>
          : <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={() => { setNome(funil.nome); setEditando(true) }}>Renomear</Botao>}
        {!funil.is_padrao && (
          <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={() => roda(() => definirPadrao({ id: funil.id }))}>Tornar padrão</Botao>
        )}
        <Botao variante="fantasma" tamanho="pequeno" tom="erro" type="button" carregando={pendente} desabilitado={bloqueiaExcluir} title={tituloExcluir}
          onClick={() => roda(() => excluirFunil({ id: funil.id }))}>Excluir</Botao>
      </span>
    </li>
  )
}
