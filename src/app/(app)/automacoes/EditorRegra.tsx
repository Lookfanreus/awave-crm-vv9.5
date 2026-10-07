'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Info } from 'lucide-react'
import { salvarNovaAutomacao, salvarEdicaoAutomacao } from './actions'
import { GATILHOS, ACOES, MAX_ACOES, type Regra, type ItemAcao, type Acao } from '@/lib/automacao-forma'
import type { Op, Condicao } from '@/lib/automacao-condicao'
import { linhasParaCondicao, condicaoParaLinhas, type LinhaCondicao, type Combinador } from '@/lib/automacao-condicao-editor'
import { TEMPLATES, templatePorId, pendenciasAbertas, type TemplateRegra } from '@/lib/automacao-templates'
import { rotuloGatilho, rotuloAcao, traduzErroAutomacao, STATUS_NEGOCIO_PT } from '@/lib/automacao-rotulos'
import Botao from '@/components/ui/Botao'
import { Entrada, Selecao } from '@/components/ui/Campo'
import estilos from './automacoes.module.css'

export type EtapaOpcao = { id: string; nome: string; funilNome: string }
export type TipoOpcao = { slug: string; nome: string }
export type CampoOpcao = { slug: string; rotulo: string }


export type AutomacaoParaEditar = {
  id: string
  nome: string
  gatilho: string
  gatilho_config: Record<string, unknown>
  condicoes: unknown
  acoes: ItemAcao[]
}

const CAMPO_FIXO_PT: Record<string, string> = {
  titulo: 'Título',
  valor: 'Valor',
  status: 'Status',
  etapa_id: 'Etapa',
  responsavel_id: 'Responsável (ID)',
}
const OP_PT: Record<Op, string> = {
  igual: 'é igual a',
  diferente: 'é diferente de',
  contem: 'contém',
  maior: 'é maior que',
  menor: 'é menor que',
  preenchido: 'está preenchido',
  vazio: 'está vazio',
}
const OPS: Op[] = ['igual', 'diferente', 'contem', 'maior', 'menor', 'preenchido', 'vazio']


type FonteEstado = {
  nome: string
  gatilho: string
  gatilho_config?: Record<string, unknown> | null
  condicoes?: unknown
  acoes: ItemAcao[]
}

function estadoInicial(automacao: FonteEstado | null) {
  const cond = condicaoParaLinhas(automacao?.condicoes as Condicao | null | undefined)
  const diasCfg = automacao?.gatilho_config?.dias
  return {
    nome: automacao?.nome ?? '',
    gatilho: automacao?.gatilho ?? (GATILHOS[0] as string),
    deEtapa: (automacao?.gatilho_config?.de_etapa_id as string) ?? '',
    paraEtapa: (automacao?.gatilho_config?.para_etapa_id as string) ?? '',
    
    
    diasParado: typeof diasCfg === 'number' ? String(diasCfg) : '',
    etapaParada: (automacao?.gatilho_config?.etapa_id as string) ?? '',
    
    tipoVencido: (automacao?.gatilho_config?.tipo_slug as string) ?? '',
    
    
    campoObservado: (automacao?.gatilho_config?.campo as string) ?? '',
    linhas: cond.linhas,
    combinador: cond.combinador,
    acoes: automacao?.acoes ?? [],
  }
}

type Estado = ReturnType<typeof estadoInicial>


function montarGatilhoConfig(e: Estado): Record<string, unknown> {
  if (e.gatilho === 'negocio_movido') {
    return { ...(e.deEtapa ? { de_etapa_id: e.deEtapa } : {}), ...(e.paraEtapa ? { para_etapa_id: e.paraEtapa } : {}) }
  }
  if (e.gatilho === 'negocio_parado') {
    return {
      ...(e.diasParado !== '' ? { dias: Number(e.diasParado) } : {}),
      ...(e.etapaParada ? { etapa_id: e.etapaParada } : {}),
    }
  }
  if (e.gatilho === 'atividade_vencida') return { ...(e.tipoVencido ? { tipo_slug: e.tipoVencido } : {}) }
  if (e.gatilho === 'campo_alterado') return { ...(e.campoObservado ? { campo: e.campoObservado } : {}) }
  return {}
}


function montarRegra(e: Estado): Regra {
  return {
    nome: e.nome,
    gatilho: e.gatilho,
    gatilho_config: montarGatilhoConfig(e),
    condicoes: linhasParaCondicao(e.linhas, e.combinador),
    acoes: e.acoes,
  }
}


export default function EditorRegra({
  automacao, etapas, tipos, campos, modeloInicial = null,
}: {
  automacao: AutomacaoParaEditar | null
  etapas: EtapaOpcao[]
  tipos: TipoOpcao[]
  campos: CampoOpcao[]
  
  modeloInicial?: string | null
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erros, setErros] = useState<string[]>([])

  const [idAtual, setIdAtual] = useState<string | null>(automacao?.id ?? null)
  
  const modelo = automacao || !modeloInicial ? undefined : templatePorId(modeloInicial)
  const [estado, setEstado] = useState(() =>
    
    
    modelo
      ? estadoInicial({ ...modelo.regra, acoes: modelo.regra.acoes.map((a) => ({ ...a })) })
      : estadoInicial(automacao),
  )
  
  
  
  const [templateId, setTemplateId] = useState<string | null>(modelo?.id ?? null)
  const {
    nome, gatilho, deEtapa, paraEtapa, diasParado, etapaParada, tipoVencido, campoObservado,
    linhas, combinador, acoes,
  } = estado

  
  
  if (idAtual !== (automacao?.id ?? null)) {
    setIdAtual(automacao?.id ?? null)
    setEstado(estadoInicial(automacao))
    
    
    
    setTemplateId(null)
    setErros([])
  }

  function set<K extends keyof ReturnType<typeof estadoInicial>>(chave: K, valor: ReturnType<typeof estadoInicial>[K]) {
    setEstado((e) => ({ ...e, [chave]: valor }))
  }

  function adicionarLinha() {
    set('linhas', [...linhas, { campo: 'titulo', op: 'igual', valor: '' }])
  }
  function atualizarLinha(i: number, patch: Partial<LinhaCondicao>) {
    set('linhas', linhas.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function removerLinha(i: number) {
    set('linhas', linhas.filter((_, idx) => idx !== i))
  }

  function adicionarAcao() {
    if (acoes.length >= MAX_ACOES) return
    set('acoes', [...acoes, { tipo: ACOES[0] } as ItemAcao])
  }
  function trocarTipoAcao(i: number, tipo: Acao) {
    
    
    set('acoes', acoes.map((a, idx) => (idx === i ? { tipo } : a)))
  }
  function atualizarAcao(i: number, patch: Record<string, unknown>) {
    set('acoes', acoes.map((a, idx) => (idx === i ? { ...a, ...patch } : a)))
  }
  function removerAcaoLinha(i: number) {
    set('acoes', acoes.filter((_, idx) => idx !== i))
  }
  function moverAcao(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= acoes.length) return
    const copia = [...acoes]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    set('acoes', copia)
  }

  
  function aplicarTemplate(t: TemplateRegra) {
    
    
    
    
    
    setEstado(estadoInicial({ ...t.regra, acoes: t.regra.acoes.map((a) => ({ ...a })) }))
    setTemplateId(t.id)
    setErros([])
  }
  function comecarDoZero() {
    setEstado(estadoInicial(null))
    setTemplateId(null)
    setErros([])
  }

  function salvar() {
    setErros([])
    const regra = montarRegra(estado)

    iniciar(async () => {
      const r = automacao ? await salvarEdicaoAutomacao(automacao.id, regra) : await salvarNovaAutomacao(regra)
      if ('erro' in r) {
        setErros(r.slugs && r.slugs.length > 0 ? r.slugs : [r.erro])
        return
      }
      const idFinal = automacao ? automacao.id : ('id' in r ? r.id : undefined)
      if (!idFinal) { router.refresh(); return }
      router.push(`/automacoes?editar=${idFinal}`)
      router.refresh()
    })
  }

  const podeSalvar = nome.trim() !== '' && acoes.length > 0

  
  
  
  const template = templateId ? templatePorId(templateId) : undefined
  const pendencias = template ? pendenciasAbertas(template, montarRegra(estado)) : []

  return (
    <section className={estilos.editor}>
      {}
      <div className={estilos.blocoTopo}>
        <h2 className={estilos.subtitulo}>{automacao ? 'Editar automação' : 'Nova automação'}</h2>
        <span className={estilos.meta}>quando → e se → então</span>
      </div>

      {}
      {!automacao && (
        <div className={estilos.blocoTemplates}>
          <span className={`${estilos.rotuloSecao} ${estilos.rotuloIcone}`}>
            <Sparkles size={14} strokeWidth={1.75} /> Começar a partir de
          </span>
          <p className={estilos.ajuda}>
            Modelos prontos das automações que mais dão resultado. Escolha um, ajuste o que for seu e crie.
          </p>
          <div className={estilos.templateGrade}>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={pendente}
                aria-pressed={templateId === t.id}
                className={`${estilos.templateCartao} ${templateId === t.id ? estilos.templateCartaoAtivo : ''}`}
                onClick={() => aplicarTemplate(t)}
              >
                <span className={estilos.templateNome}>{t.nome}</span>
                <span className={estilos.templateDesc}>{t.descricao}</span>
              </button>
            ))}
          </div>
          {templateId && (
            <Botao type="button" className={estilos.acaoLocal} carregando={pendente} onClick={comecarDoZero}>
              Limpar e começar do zero
            </Botao>
          )}
        </div>
      )}

      {}
      {template && (pendencias.length > 0 || template.observacao) && (
        <div className={estilos.notaTemplate}>
          <Info size={16} strokeWidth={1.75} />
          <div className={estilos.notaTemplateCorpo}>
            {pendencias.length > 0 && (
              <>
                <strong className={estilos.notaTemplateTitulo}>Falta você escolher:</strong>
                <ul className={estilos.notaTemplateLista}>
                  {pendencias.map((p) => (
                    <li key={p.campo}>
                      <span className={estilos.notaTemplateCampo}>{p.campo}</span>
                      <span className={`${estilos.pendenciaTag} ${p.bloqueiaSalvar ? estilos.pendenciaObrigatoria : estilos.pendenciaRecomendada}`}>
                        {p.bloqueiaSalvar ? 'Obrigatório' : 'Recomendado'}
                      </span>
                      <span className={estilos.notaTemplateTexto}>{p.texto}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {template.observacao && <p className={estilos.notaTemplateTexto}>{template.observacao}</p>}
          </div>
        </div>
      )}

      {erros.length > 0 && (
        <ul className={estilos.erroLista}>
          {erros.map((e, i) => <li key={e + i}>{traduzErroAutomacao(e)}</li>)}
        </ul>
      )}

      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Nome</span>
        <Entrada value={nome} disabled={pendente}
          placeholder="Ex.: Ligar quando negócio fechar"
          onChange={(e) => set('nome', e.target.value)} />
      </label>

      <label className={estilos.campo}>
        <span className={estilos.rotulo}>Quando</span>
        <Selecao value={gatilho} disabled={pendente}
          onChange={(e) => set('gatilho', e.target.value)}>
          {GATILHOS.map((g) => <option key={g} value={g}>{rotuloGatilho(g)}</option>)}
        </Selecao>
      </label>

      {gatilho === 'negocio_movido' && (
        <div className={estilos.linhaDupla}>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>De (opcional)</span>
            <Selecao value={deEtapa} disabled={pendente}
              onChange={(e) => set('deEtapa', e.target.value)}>
              <option value="">Qualquer etapa</option>
              {etapas.map((et) => <option key={et.id} value={et.id}>{et.funilNome} › {et.nome}</option>)}
            </Selecao>
          </label>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Para (opcional)</span>
            <Selecao value={paraEtapa} disabled={pendente}
              onChange={(e) => set('paraEtapa', e.target.value)}>
              <option value="">Qualquer etapa</option>
              {etapas.map((et) => <option key={et.id} value={et.id}>{et.funilNome} › {et.nome}</option>)}
            </Selecao>
          </label>
        </div>
      )}

      {gatilho === 'negocio_parado' && (
        
        
        
        <div className={estilos.linhaDupla}>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Dias parado</span>
            <Entrada type="number" min="1" step="1" placeholder="Ex.: 3" disabled={pendente}
              value={diasParado} onChange={(e) => set('diasParado', e.target.value)} />
          </label>
          <label className={estilos.campo}>
            <span className={estilos.rotulo}>Etapa (opcional)</span>
            <Selecao value={etapaParada} disabled={pendente}
              onChange={(e) => set('etapaParada', e.target.value)}>
              <option value="">Qualquer etapa</option>
              {etapas.map((et) => <option key={et.id} value={et.id}>{et.funilNome} › {et.nome}</option>)}
            </Selecao>
          </label>
        </div>
      )}

      {gatilho === 'atividade_vencida' && (
        
        
        
        <label className={estilos.campo}>
          <span className={estilos.rotulo}>Tipo de atividade (opcional)</span>
          <Selecao value={tipoVencido} disabled={pendente}
            onChange={(e) => set('tipoVencido', e.target.value)}>
            <option value="">Qualquer tipo</option>
            {tipos.map((t) => <option key={t.slug} value={t.slug}>{t.nome}</option>)}
          </Selecao>
        </label>
      )}

      {gatilho === 'campo_alterado' && (
        
        
        
        
        
        <label className={estilos.campo}>
          <span className={estilos.rotulo}>Campo observado</span>
          <Selecao value={campoObservado} disabled={pendente}
            onChange={(e) => set('campoObservado', e.target.value)}>
            <option value="">Escolha o campo…</option>
            {campos.map((c) => <option key={c.slug} value={c.slug}>{c.rotulo}</option>)}
          </Selecao>
        </label>
      )}

      <div className={estilos.blocoCondicao}>
        <span className={estilos.rotuloSecao}>E se (opcional)</span>
        {linhas.length === 0 && <p className={estilos.ajuda}>Sem condição — a regra sempre dispara.</p>}
        {linhas.map((l, i) => (
          <div key={i} className={estilos.linhaCondicao}>
            {i > 0 && (
              <Selecao className={estilos.combinador} value={combinador} disabled={pendente}
                onChange={(e) => set('combinador', e.target.value as Combinador)}>
                <option value="e">e</option>
                <option value="ou">ou</option>
              </Selecao>
            )}
            <Selecao value={l.campo} disabled={pendente}
              onChange={(e) => atualizarLinha(i, { campo: e.target.value })}>
              {Object.entries(CAMPO_FIXO_PT).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              {campos.map((c) => <option key={c.slug} value={c.slug}>{c.rotulo}</option>)}
            </Selecao>
            <Selecao value={l.op} disabled={pendente}
              onChange={(e) => atualizarLinha(i, { op: e.target.value as Op })}>
              {OPS.map((op) => <option key={op} value={op}>{OP_PT[op]}</option>)}
            </Selecao>
            {l.op !== 'preenchido' && l.op !== 'vazio' && (
              l.campo === 'status' ? (
                <Selecao value={l.valor} disabled={pendente}
                  onChange={(e) => atualizarLinha(i, { valor: e.target.value })}>
                  <option value="">—</option>
                  {Object.entries(STATUS_NEGOCIO_PT).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </Selecao>
              ) : l.campo === 'etapa_id' ? (
                <Selecao value={l.valor} disabled={pendente}
                  onChange={(e) => atualizarLinha(i, { valor: e.target.value })}>
                  <option value="">—</option>
                  {etapas.map((et) => <option key={et.id} value={et.id}>{et.funilNome} › {et.nome}</option>)}
                </Selecao>
              ) : (
                <Entrada value={l.valor} disabled={pendente} placeholder="Valor"
                  onChange={(e) => atualizarLinha(i, { valor: e.target.value })} />
              )
            )}
            <Botao variante="fantasma" tamanho="pequeno" tom="erro" soIcone type="button" carregando={pendente} aria-label="Remover condição"
              onClick={() => removerLinha(i)}>
              <Trash2 size={14} />
            </Botao>
          </div>
        ))}
        <Botao type="button" className={estilos.acaoLocal} carregando={pendente} onClick={adicionarLinha}>
          <Plus size={14} /> {linhas.length === 0 ? 'Adicionar condição' : `Adicionar "${combinador}"`}
        </Botao>
      </div>

      <div className={estilos.blocoAcoes}>
        <span className={estilos.rotuloSecao}>Então</span>
        {acoes.length === 0 && <p className={estilos.ajuda}>Adicione ao menos uma ação.</p>}
        <ul className={estilos.acaoLista}>
          {acoes.map((a, i) => (
            <li key={i} className={estilos.acaoItem}>
              <div className={estilos.acaoTopo}>
                <span className={estilos.acaoOrdem}>{i + 1}</span>
                <Selecao value={a.tipo} disabled={pendente}
                  onChange={(e) => trocarTipoAcao(i, e.target.value as Acao)}>
                  {ACOES.map((t) => <option key={t} value={t}>{rotuloAcao(t)}</option>)}
                </Selecao>
                <span className={estilos.acaoMover}>
                  <Botao variante="fantasma" tamanho="pequeno" soIcone type="button" carregando={pendente} desabilitado={i === 0} aria-label="Mover para cima"
                    onClick={() => moverAcao(i, -1)}>
                    <ChevronUp size={14} />
                  </Botao>
                  <Botao variante="fantasma" tamanho="pequeno" soIcone type="button" carregando={pendente} desabilitado={i === acoes.length - 1} aria-label="Mover para baixo"
                    onClick={() => moverAcao(i, 1)}>
                    <ChevronDown size={14} />
                  </Botao>
                </span>
                <Botao variante="fantasma" tamanho="pequeno" tom="erro" soIcone type="button" carregando={pendente} aria-label="Remover ação"
                  onClick={() => removerAcaoLinha(i)}>
                  <Trash2 size={14} />
                </Botao>
              </div>
              <div className={estilos.acaoConfig}>
                <ConfigAcao acao={a} atualizar={(patch) => atualizarAcao(i, patch)} etapas={etapas} tipos={tipos} campos={campos} pendente={pendente} />
              </div>
            </li>
          ))}
        </ul>
        <Botao type="button" className={estilos.acaoLocal} carregando={pendente} desabilitado={acoes.length >= MAX_ACOES} onClick={adicionarAcao}>
          <Plus size={14} /> Adicionar ação
        </Botao>
        {acoes.length >= MAX_ACOES && <p className={estilos.ajuda}>Máximo de {MAX_ACOES} ações por automação.</p>}
      </div>

      <Botao variante="primario" type="button" className={estilos.acaoLocal} carregando={pendente} desabilitado={!podeSalvar} onClick={salvar}>
        {automacao ? 'Salvar alterações' : 'Criar automação'}
      </Botao>
      {!automacao && <p className={estilos.ajuda}>A automação nasce desligada — ligue na lista ao lado quando estiver pronta.</p>}
    </section>
  )
}


function ConfigAcao({
  acao, atualizar, etapas, tipos, campos, pendente,
}: {
  acao: ItemAcao
  atualizar: (patch: Record<string, unknown>) => void
  etapas: EtapaOpcao[]
  tipos: TipoOpcao[]
  campos: CampoOpcao[]
  pendente: boolean
}) {
  switch (acao.tipo) {
    case 'mover_etapa':
      return (
        <Selecao value={(acao.etapa_id as string) ?? ''} disabled={pendente}
          onChange={(e) => atualizar({ etapa_id: e.target.value })}>
          <option value="">Escolha a etapa…</option>
          {etapas.map((et) => <option key={et.id} value={et.id}>{et.funilNome} › {et.nome}</option>)}
        </Selecao>
      )
    case 'criar_atividade':
      return (
        <div className={estilos.linhaTripla}>
          <Selecao value={(acao.tipo_slug as string) ?? ''} disabled={pendente}
            onChange={(e) => atualizar({ tipo_slug: e.target.value })}>
            <option value="">Tipo de atividade…</option>
            {tipos.map((t) => <option key={t.slug} value={t.slug}>{t.nome}</option>)}
          </Selecao>
          <Entrada placeholder="Conteúdo (opcional)" disabled={pendente}
            value={(acao.conteudo as string) ?? ''} onChange={(e) => atualizar({ conteudo: e.target.value })} />
          <Entrada type="number" min="0" placeholder="Vencer em (dias)" disabled={pendente}
            value={acao.vencimento_dias === undefined ? '' : (acao.vencimento_dias as number)}
            onChange={(e) => atualizar({ vencimento_dias: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </div>
      )
    case 'atribuir_responsavel':
      return <p className={estilos.acaoNota}>Atribui por rodízio entre os membros do espaço de trabalho.</p>
    case 'chamar_webhook':
      return <p className={estilos.acaoNota}>Dispara o webhook configurado em "Integração por API", se houver um ativo.</p>
    case 'atualizar_campo':
      return (
        <div className={estilos.linhaDupla}>
          <Selecao value={(acao.campo as string) ?? ''} disabled={pendente}
            onChange={(e) => atualizar({ campo: e.target.value })}>
            <option value="">Campo…</option>
            {campos.map((c) => <option key={c.slug} value={c.slug}>{c.rotulo}</option>)}
          </Selecao>
          <Entrada placeholder="Novo valor" disabled={pendente}
            value={(acao.valor as string) ?? ''} onChange={(e) => atualizar({ valor: e.target.value })} />
        </div>
      )
    case 'criar_negocio':
      return (
        <div className={estilos.linhaDupla}>
          <Entrada placeholder="Título do novo negócio" disabled={pendente}
            value={(acao.titulo as string) ?? ''} onChange={(e) => atualizar({ titulo: e.target.value })} />
          <Selecao value={(acao.etapa_id as string) ?? ''} disabled={pendente}
            onChange={(e) => atualizar({ etapa_id: e.target.value })}>
            <option value="">Etapa inicial (opcional)</option>
            {etapas.map((et) => <option key={et.id} value={et.id}>{et.funilNome} › {et.nome}</option>)}
          </Selecao>
        </div>
      )
    default:
      return null
  }
}
