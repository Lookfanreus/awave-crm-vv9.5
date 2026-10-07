'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarTipo, renomearTipo, arquivarTipo, reativarTipo, excluirTipo, type TipoCompleto } from '@/server/crm/tipos'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './config.module.css'

const ERRO_PT: Record<string, string> = {
  bloqueado: 'Tipos padrão do sistema não podem ser alterados.',
  em_uso: 'Este tipo está em uso por atividades — arquive em vez de excluir.',
  nome_vazio: 'Dê um nome ao tipo.',
  nao_encontrado: 'Tipo não encontrado.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
}
function traduz(e: string) { return ERRO_PT[e] ?? 'Não foi possível concluir. Tente novamente.' }

export default function TiposAtividade({ tipos }: { tipos: TipoCompleto[] }) {
  const router = useRouter()
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function roda(fn: () => Promise<{ ok: true } | { erro: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if ('erro' in r) setErro(traduz(r.erro))
      else router.refresh()
    })
  }

  
  
  
  
  
  
  
  const fixos = tipos.filter((t) => t.bloqueado).length
  return (
    <section className={estilos.bloco}>
      <div className={estilos.linhaForm}>
        <Entrada value={novo} placeholder="Novo tipo (ex.: Visita)"
          aria-label="Nome do novo tipo"
          onChange={(e) => setNovo(e.target.value)} disabled={pendente}
          onKeyDown={(e) => { if (e.key === 'Enter' && novo.trim()) roda(async () => { const r = await criarTipo({ nome: novo }); if ('ok' in r) setNovo(''); return r }) }} />
        <Botao variante="primario" type="button" carregando={pendente} desabilitado={!novo.trim()}
          onClick={() => roda(async () => { const r = await criarTipo({ nome: novo }); if ('ok' in r) setNovo(''); return r })}>
          Adicionar
        </Botao>
      </div>
      {erro && <p className={estilos.erro}>{erro}</p>}

      {}
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Seus tipos</h2>
        <span className={estilos.blocoMeta}>
          {tipos.length} no total · {fixos} fixos do sistema
        </span>
      </div>
      <ul className={estilos.lista}>
        {tipos.map((t) => (
          <LinhaTipo key={t.id} tipo={t} pendente={pendente} roda={roda} />
        ))}
      </ul>
    </section>
  )
}

function LinhaTipo({ tipo, pendente, roda }: {
  tipo: TipoCompleto; pendente: boolean
  roda: (fn: () => Promise<{ ok: true } | { erro: string }>) => void
}) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(tipo.nome)
  const sistema = tipo.bloqueado

  function salvar() { roda(() => renomearTipo({ id: tipo.id, nome })); setEditando(false) }

  return (
    <li className={`${estilos.item} ${!tipo.ativo ? estilos.tipoArquivado : ''}`}>
      {editando ? (
        <Entrada value={nome} autoFocus
          aria-label="Novo nome do tipo"
          onChange={(e) => setNome(e.target.value)} disabled={pendente}
          onKeyDown={(e) => { if (e.key === 'Enter') salvar() }} />
      ) : (
        <span className={estilos.tipoNome}>
          {tipo.nome}
          {}
          {!tipo.ativo && <span className={estilos.tipoTag}>arquivado</span>}
        </span>
      )}
      {sistema ? (
        <span className={estilos.tipoFixo}>Fixo do sistema</span>
      ) : (
        <span className={estilos.acoes}>
          {editando
            ? <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={salvar}>Salvar</Botao>
            : <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={() => setEditando(true)}>Renomear</Botao>}
          {tipo.ativo
            ? <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={() => roda(() => arquivarTipo({ id: tipo.id }))}>Arquivar</Botao>
            : <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} onClick={() => roda(() => reativarTipo({ id: tipo.id }))}>Reativar</Botao>}
          {}
          <Botao variante="fantasma" tamanho="pequeno" tom="erro" type="button"
            carregando={pendente} desabilitado={tipo.uso > 0} title={tipo.uso > 0 ? `Em uso por ${tipo.uso} atividade(s)` : 'Excluir de vez'}
            onClick={() => roda(() => excluirTipo({ id: tipo.id }))}>Excluir</Botao>
        </span>
      )}
    </li>
  )
}
