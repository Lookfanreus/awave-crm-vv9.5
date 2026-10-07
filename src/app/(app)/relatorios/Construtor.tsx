'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Save, Download } from 'lucide-react'
import {
  TIPOS_RELATORIO, ROTULO_TIPO, ROTULO_STATUS, paramsDeConfig,
  type ConfigRelatorio, type TipoRelatorio, type StatusFiltro,
} from '@/lib/relatorios'
import { salvarNovoRelatorio, salvarEdicaoRelatorio } from './actions'
import Botao from '@/components/ui/Botao'
import { Entrada, Selecao } from '@/components/ui/Campo'
import estilos from './relatorios.module.css'

const ERRO_PT: Record<string, string> = {
  nome_vazio: 'Dê um nome ao relatório para salvá-lo.',
  nome_longo: 'Nome muito longo (máximo 120 caracteres).',
  tipo_invalido: 'Esse tipo de relatório não existe.',
  nao_encontrado: 'Relatório não encontrado.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
  falha_salvar: 'Não foi possível salvar. Tente novamente.',
}

export type FunilOpcao = { id: string; nome: string }
export type AgrupamentoOpcao = { slug: string; rotulo: string }


export default function Construtor({ tipo, config, funis, agrupamentos, salvo }: {
  tipo: TipoRelatorio
  config: ConfigRelatorio
  funis: FunilOpcao[]
  agrupamentos: AgrupamentoOpcao[]
  
  salvo?: { id: string; nome: string }
}) {
  const router = useRouter()
  const [form, setForm] = useState<{ tipo: TipoRelatorio } & ConfigRelatorio>({ tipo, ...config })
  const [nome, setNome] = useState(salvo?.nome ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const { tipo: tipoForm, ...configForm } = form
  const query = paramsDeConfig(tipoForm, configForm).toString()
  const base = salvo ? `/relatorios/${salvo.id}` : '/relatorios'
  
  
  const linkCsv = `/relatorios/exportar?${query}${salvo ? `&salvo=${salvo.id}` : ''}`

  function mudar<K extends keyof typeof form>(chave: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [chave]: valor }))
  }

  function rodar() {
    setErro(null)
    router.push(`${base}?${query}`)
  }

  function salvarPergunta() {
    setErro(null)
    iniciar(async () => {
      const entrada = { nome, tipo: tipoForm, config: configForm }
      const r = salvo
        ? await salvarEdicaoRelatorio({ id: salvo.id, ...entrada })
        : await salvarNovoRelatorio(entrada)
      if ('erro' in r) { setErro(ERRO_PT[r.erro] ?? 'Não foi possível salvar. Tente novamente.'); return }
      
      
      
      
      
      
      
      
      
      if (salvo?.id === r.id) router.refresh()
      else router.push(`/relatorios/${r.id}?${query}`)
    })
  }

  return (
    <section className={estilos.construtor}>
      {}
      <div className={estilos.blocoTopo}>
        <h2 className={estilos.subtitulo}>Monte a pergunta</h2>
        <span className={estilos.meta}>{ROTULO_TIPO[tipoForm]}</span>
      </div>

      <div className={estilos.filtros}>
        <label className={estilos.campo}>
          <span className={estilos.rotulo}>Tipo</span>
          <Selecao value={tipoForm} disabled={pendente}
            onChange={(e) => mudar('tipo', e.target.value as TipoRelatorio)}>
            {TIPOS_RELATORIO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
          </Selecao>
        </label>

        <label className={estilos.campo}>
          <span className={estilos.rotulo}>Funil</span>
          <Selecao value={configForm.funilId ?? ''} disabled={pendente}
            onChange={(e) => mudar('funilId', e.target.value || null)}>
            <option value="">Funil padrão</option>
            {funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Selecao>
        </label>

        <label className={estilos.campo}>
          <span className={estilos.rotulo}>De</span>
          <Entrada type="date" value={configForm.de ?? ''} disabled={pendente}
            onChange={(e) => mudar('de', e.target.value || null)} />
        </label>

        <label className={estilos.campo}>
          <span className={estilos.rotulo}>Até</span>
          <Entrada type="date" value={configForm.ate ?? ''} disabled={pendente}
            onChange={(e) => mudar('ate', e.target.value || null)} />
        </label>

        {tipoForm === 'tabela' && (
          <>
            <label className={estilos.campo}>
              <span className={estilos.rotulo}>Situação</span>
              <Selecao value={configForm.status} disabled={pendente}
                onChange={(e) => mudar('status', e.target.value as StatusFiltro)}>
                {(Object.keys(ROTULO_STATUS) as StatusFiltro[]).map((s) => (
                  <option key={s} value={s}>{ROTULO_STATUS[s]}</option>
                ))}
              </Selecao>
            </label>
            <label className={estilos.campo}>
              <span className={estilos.rotulo}>Agrupar por</span>
              {}
              <Selecao value={configForm.agrupamento ?? '@etapa'} disabled={pendente}
                onChange={(e) => mudar('agrupamento', e.target.value)}>
                {agrupamentos.map((a) => <option key={a.slug} value={a.slug}>{a.rotulo}</option>)}
              </Selecao>
            </label>
          </>
        )}
      </div>

      {}
      <div className={estilos.acoes}>
        <Botao variante="primario" type="button" onClick={rodar} carregando={pendente}>
          <Play size={15} strokeWidth={2} /> Ver resultado
        </Botao>
        <div className={estilos.acoesGuardar}>
          <Entrada value={nome} placeholder="Nome do relatório (ex.: Conversão Q3)"
            onChange={(e) => setNome(e.target.value)} disabled={pendente} />
          <Botao type="button" onClick={salvarPergunta} carregando={pendente} desabilitado={!nome.trim()}>
            <Save size={15} strokeWidth={2} /> {salvo ? 'Salvar alterações' : 'Salvar relatório'}
          </Botao>
          <Botao href={linkCsv}>
            <Download size={15} strokeWidth={2} /> Exportar CSV
          </Botao>
        </div>
      </div>

      {erro && <p className={estilos.erro}>{erro}</p>}
    </section>
  )
}
