'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { salvarCampos } from '@/server/crm/acoes'
import type { Entidade } from '@/server/crm/campos-def'
import type { DefCampoUI } from '@/server/crm/campos-leitura'
import type { OpcaoCampo } from '@/lib/campos-valor'
import Botao from '@/components/ui/Botao'
import { Entrada, Selecao, AreaTexto } from '@/components/ui/Campo'
import estilos from './crm.module.css'

const ERRO_PT: Record<string, string> = {
  campo_invalido: 'Confira os campos destacados.',
  nao_encontrado: 'Registro não encontrado.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
  falha_salvar: 'Não foi possível salvar. Tente novamente.',
}


export default function CamposCustomizados({ entidade, id, campos, definicoes, obrigatorios = [] }: {
  entidade: Entidade
  id: string
  campos: Record<string, unknown>
  definicoes: DefCampoUI[]
  
  obrigatorios?: string[]
}) {
  const router = useRouter()
  const [rascunho, setRascunho] = useState<Record<string, unknown>>(campos)
  const [invalidos, setInvalidos] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  
  if (definicoes.length === 0) return null

  const sujo = JSON.stringify(rascunho) !== JSON.stringify(campos)

  function definir(slug: string, valor: unknown) {
    setRascunho((r) => ({ ...r, [slug]: valor }))
    setInvalidos((v) => v.filter((s) => s !== slug))
  }

  function salvar() {
    setErro(null); setInvalidos([])
    iniciar(async () => {
      const r = await salvarCampos({ entidade, id, patch: rascunho })
      if ('erro' in r) {
        setErro(ERRO_PT[r.erro] ?? ERRO_PT.falha_salvar)
        setInvalidos(r.slugs ?? [])
      } else {
        router.refresh()
      }
    })
  }

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Campos</h2>
      </div>
      {erro && <p className={`${estilos.erro} ${estilos.blocoCorpo}`}>{erro}</p>}

      <div className={`${estilos.camposGrade} ${estilos.blocoCorpo}`}>
        {definicoes.map((def) => (
          <CampoEntrada
            key={def.slug}
            def={def}
            valor={rascunho[def.slug]}
            invalido={invalidos.includes(def.slug)}
            obrigatorio={obrigatorios.includes(def.slug)}
            desabilitado={pendente}
            onChange={(v) => definir(def.slug, v)}
          />
        ))}
      </div>

      {sujo && (
        <div className={estilos.camposSalvar}>
          <Botao variante="primario" larguraTotal type="button" carregando={pendente} onClick={salvar} className={estilos.salvar}>
            {pendente ? 'Salvando…' : 'Salvar campos'}
          </Botao>
        </div>
      )}
    </section>
  )
}

function CampoEntrada({ def, valor, invalido, obrigatorio, desabilitado, onChange }: {
  def: DefCampoUI
  valor: unknown
  invalido: boolean
  obrigatorio: boolean
  desabilitado: boolean
  onChange: (v: unknown) => void
}) {
  const id = `campo-${def.slug}`
  const rotuloId = `${id}-rotulo`
  
  const opcoes: OpcaoCampo[] = (def.opcoes ?? []).filter((o) => !o.arquivada)
  const texto = typeof valor === 'string' ? valor : valor == null ? '' : String(valor)

  return (
    <div className={estilos.campo}>
      {}
      <label className={estilos.rotulo} htmlFor={id} id={rotuloId}>
        {def.rotulo}
        {obrigatorio && (
          <span className={estilos.obrigatorio} title="Obrigatório para o negócio sair desta etapa"> *</span>
        )}
      </label>

      {def.tipo === 'texto_longo' ? (
        <AreaTexto id={id} aria-invalid={invalido}
          value={texto} disabled={desabilitado} rows={3}
          onChange={(e) => onChange(e.target.value)} />

      ) : def.tipo === 'checkbox' ? (
        <input id={id} type="checkbox" checked={valor === true} disabled={desabilitado}
          onChange={(e) => onChange(e.target.checked)} />

      ) : def.tipo === 'selecao_unica' ? (
        <Selecao id={id} aria-invalid={invalido}
          value={texto} disabled={desabilitado}
          onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
        </Selecao>

      ) : def.tipo === 'selecao_multipla' ? (
        <ChipsMultipla
          id={id}
          rotuloId={rotuloId}
          opcoes={opcoes}
          marcados={Array.isArray(valor) ? (valor as string[]) : []}
          desabilitado={desabilitado}
          onChange={onChange}
        />

      ) : (
        <Entrada id={id} aria-invalid={invalido} disabled={desabilitado}
          type={def.tipo === 'data' ? 'date' : def.tipo === 'numero' ? 'number' : def.tipo === 'email' ? 'email' : 'text'}
          inputMode={def.tipo === 'moeda' ? 'decimal' : undefined}
          placeholder={def.tipo === 'moeda' ? '0.00' : undefined}
          value={texto}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}


function ChipsMultipla({ id, rotuloId, opcoes, marcados, desabilitado, onChange }: {
  id: string
  rotuloId: string
  opcoes: OpcaoCampo[]
  marcados: string[]
  desabilitado: boolean
  onChange: (v: unknown) => void
}) {
  if (opcoes.length === 0) {
    return <p className={estilos.chipsVazio}>Nenhuma opção configurada para este campo.</p>
  }

  function alternar(opcaoId: string) {
    
    
    
    
    onChange(marcados.includes(opcaoId)
      ? marcados.filter((x) => x !== opcaoId)
      : [...marcados, opcaoId])
  }

  return (
    <div className={estilos.chips} id={id} role="group" aria-labelledby={rotuloId}>
      {opcoes.map((o) => {
        const ativo = marcados.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            className={`${estilos.chip}${ativo ? ` ${estilos.chipAtivo}` : ''}`}
            aria-pressed={ativo}
            disabled={desabilitado}
            onClick={() => alternar(o.id)}
          >
            {}
            {o.cor && <span className={estilos.chipPonto} style={{ background: o.cor }} aria-hidden />}
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}
