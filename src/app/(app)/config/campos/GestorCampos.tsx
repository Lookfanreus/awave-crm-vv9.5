'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Archive, RotateCcw, Trash2, Pencil } from 'lucide-react'
import { TIPOS_CAMPO, type TipoCampo } from '@/lib/campos-valor'
import {
  criarCampo, renomearCampo, arquivarCampo, reativarCampo, excluirCampo,
  type CampoCompleto, type Entidade,
} from '@/server/crm/campos-def'
import EditorOpcoes from './EditorOpcoes'
import Botao from '@/components/ui/Botao'
import { Entrada, Selecao } from '@/components/ui/Campo'
import estilos from './campos.module.css'

const ERRO_PT: Record<string, string> = {
  rotulo_vazio: 'Dê um nome ao campo.',
  tipo_invalido: 'Tipo de campo inválido.',
  opcoes_obrigatorias: 'Campos de seleção precisam de ao menos uma opção.',
  opcoes_demais: 'Um campo de seleção aceita no máximo 200 opções.',
  opcao_invalida: 'Toda opção precisa de um identificador e um rótulo de até 100 caracteres.',
  opcao_repetida: 'Há opções repetidas.',
  tipo_sem_opcoes: 'Este tipo de campo não tem opções.',
  em_uso: 'Este campo já tem valor gravado — arquive em vez de excluir.',
  slug_invalido: 'Identificador do campo em formato inesperado.',
  nao_encontrado: 'Campo não encontrado.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
}
function traduz(e: string) { return ERRO_PT[e] ?? 'Não foi possível concluir. Tente novamente.' }

export const ROTULO_TIPO: Record<TipoCampo, string> = {
  texto: 'Texto', texto_longo: 'Texto longo', numero: 'Número', moeda: 'Moeda', data: 'Data',
  selecao_unica: 'Seleção única', selecao_multipla: 'Seleção múltipla', checkbox: 'Caixa de seleção',
  email: 'E-mail', telefone: 'Telefone', documento: 'CPF/CNPJ', responsavel: 'Responsável',
  conexao_contato: 'Contato', conexao_empresa: 'Empresa', conexao_negocio: 'Negócio',
}
const PRECISA_OPCOES: TipoCampo[] = ['selecao_unica', 'selecao_multipla']

type Acao = () => Promise<{ ok: true; id?: string } | { erro: string }>

export default function GestorCampos({ entidade, entidades, campos, funis }: {
  entidade: Entidade
  entidades: { chave: Entidade; rotulo: string }[]
  campos: CampoCompleto[]
  funis: { id: string; nome: string; is_padrao: boolean }[]
}) {
  const router = useRouter()
  const [rotulo, setRotulo] = useState('')
  const [tipo, setTipo] = useState<TipoCampo>('texto')
  const [escopo, setEscopo] = useState<string>('')     
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const rotuloEntidade = entidades.find((e) => e.chave === entidade)?.rotulo ?? 'registros'

  function roda(fn: Acao) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if ('erro' in r) setErro(traduz(r.erro))
      else router.refresh()
    })
  }

  function adicionar() {
    
    
    const opcoes = PRECISA_OPCOES.includes(tipo) ? [{ id: 'opcao_1', rotulo: 'Opção 1' }] : undefined
    roda(async () => {
      const r = await criarCampo({ entidade, rotulo, tipo, pipelineId: escopo || null, opcoes })
      if ('ok' in r) setRotulo('')
      return r
    })
  }

  return (
    <section className={estilos.cartao}>
      {}
      <nav className={estilos.segmentado} aria-label="Tipo de registro">
        {entidades.map((e) => (
          <a key={e.chave}
            href={`/config/campos?entidade=${e.chave}`}
            
            
            
            
            
            
            
            
            
            
            
            aria-current={e.chave === entidade ? 'true' : undefined}
            className={`${estilos.segmento} ${e.chave === entidade ? estilos.segmentoAtivo : ''}`}>
            {e.rotulo}
          </a>
        ))}
      </nav>

      <div className={estilos.novoRow}>
        <Entrada value={rotulo} placeholder="Novo campo (ex.: Valor do contrato)"
          onChange={(ev) => setRotulo(ev.target.value)} disabled={pendente}
          onKeyDown={(ev) => { if (ev.key === 'Enter' && rotulo.trim()) adicionar() }} />
        <Selecao value={tipo} disabled={pendente}
          aria-label="Tipo do campo"
          onChange={(ev) => setTipo(ev.target.value as TipoCampo)}>
          {TIPOS_CAMPO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
        </Selecao>
        {entidade === 'negocio' && (
          <Selecao value={escopo} disabled={pendente}
            aria-label="Onde o campo aparece"
            onChange={(ev) => setEscopo(ev.target.value)}>
            <option value="">Todos os funis</option>
            {funis.map((f) => <option key={f.id} value={f.id}>Só em: {f.nome}</option>)}
          </Selecao>
        )}
        <Botao variante="primario" type="button" carregando={pendente} desabilitado={!rotulo.trim()}
          onClick={adicionar}>
          <Plus size={18} strokeWidth={1.75} /> Adicionar
        </Botao>
      </div>
      {erro && <p className={estilos.erro}>{erro}</p>}

      {}
      <div className={estilos.listaCab}>
        <h2 className={estilos.subtitulo}>Campos de {rotuloEntidade.toLowerCase()}</h2>
        <span className={estilos.meta}>
          {campos.length === 0 ? 'nenhum' : `${campos.length} campo${campos.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {campos.length === 0 ? (
        <p className={estilos.vazio}>Nenhum campo ainda. Crie o primeiro acima.</p>
      ) : (
        <ul className={estilos.lista}>
          {campos.map((c) => (
            <LinhaCampo key={c.id} campo={c} funis={funis} pendente={pendente} roda={roda} />
          ))}
        </ul>
      )}
    </section>
  )
}

function LinhaCampo({ campo, funis, pendente, roda }: {
  campo: CampoCompleto
  funis: { id: string; nome: string }[]
  pendente: boolean
  roda: (fn: Acao) => void
}) {
  const [editando, setEditando] = useState(false)
  const [rotulo, setRotulo] = useState(campo.rotulo)
  const escopoNome = campo.pipeline_id ? funis.find((f) => f.id === campo.pipeline_id)?.nome : null

  
  function abrirEdicao() { setRotulo(campo.rotulo); setEditando(true) }

  
  function salvar() {
    roda(async () => {
      const r = await renomearCampo({ id: campo.id, rotulo })
      if ('ok' in r) setEditando(false)
      return r
    })
  }

  return (
    <li className={`${estilos.item} ${!campo.ativo ? estilos.itemArquivado : ''}`}>
      <div className={estilos.itemTopo}>
        {editando ? (
          <Entrada value={rotulo} autoFocus disabled={pendente}
            aria-label="Novo nome do campo"
            onChange={(e) => setRotulo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') salvar() }} />
        ) : (
          <span className={estilos.itemNome}>
            {campo.rotulo}
            <span className={estilos.tag}>{ROTULO_TIPO[campo.tipo]}</span>
            {escopoNome && <span className={estilos.tag}>só em {escopoNome}</span>}
            {!campo.ativo && <span className={estilos.tag}>arquivado</span>}
            {campo.uso > 0 && <span className={estilos.tagUso}>{campo.uso} preenchido(s)</span>}
          </span>
        )}

        <span className={estilos.acoes}>
          {editando
            ? <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} desabilitado={!rotulo.trim()}
                onClick={salvar}>Salvar</Botao>
            : <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente}
                onClick={abrirEdicao} title="Renomear (o campo continua o mesmo)">
                <Pencil size={16} strokeWidth={1.75} /> Renomear
              </Botao>}
          {campo.ativo
            ? <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente}
                onClick={() => roda(() => arquivarCampo({ id: campo.id }))}>
                <Archive size={16} strokeWidth={1.75} /> Arquivar
              </Botao>
            : <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente}
                onClick={() => roda(() => reativarCampo({ id: campo.id }))}>
                <RotateCcw size={16} strokeWidth={1.75} /> Reativar
              </Botao>}
          <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} desabilitado={campo.uso > 0}
            title={campo.uso > 0 ? `${campo.uso} registro(s) com valor — arquive em vez de excluir` : 'Excluir de vez'}
            onClick={() => roda(() => excluirCampo({ id: campo.id }))}>
            <Trash2 size={16} strokeWidth={1.75} /> Excluir
          </Botao>
        </span>
      </div>

      {(campo.tipo === 'selecao_unica' || campo.tipo === 'selecao_multipla') && (
        <EditorOpcoes campo={campo} pendente={pendente} roda={roda} />
      )}
    </li>
  )
}
