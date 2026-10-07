'use client'
import { useState, useTransition } from 'react'
import { Upload } from 'lucide-react'
import { previewImportacao, executarImportacao, type Preview } from '@/server/crm/importar'
import { paraCsv } from '@/lib/csv'
import type { Entidade } from '@/server/crm/campos-def'
import type { Mapeamento } from '@/lib/importacao'
import { normalizar } from '@/lib/texto'
import Botao from '@/components/ui/Botao'
import { Selecao } from '@/components/ui/Campo'
import { decodificarCsv } from '@/lib/csv-codificacao'
import estilos from './importar.module.css'

const ERRO_PT: Record<string, string> = {
  arquivo_vazio: 'O arquivo não tem nenhuma linha de dados.',
  arquivo_grande: 'Arquivo muito grande — o limite é 5.000 linhas por importação.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
  sem_pipeline: 'Este espaço de trabalho não tem funil padrão — crie um antes de importar negócios.',
  sem_etapa: 'O funil padrão não tem etapas — adicione ao menos uma antes de importar.',
  funil_invalido: 'O funil escolhido não existe mais. Recarregue a página e tente de novo.',
  etapa_invalida: 'A etapa escolhida não é desse funil. Escolha o funil e a etapa de novo.',
  chave_invalida: 'A coluna escolhida para evitar duplicados não serve como chave.',
}

type Relatorio = { criados: number; atualizados: number; erros: { linha: number; motivo: string }[] }

export default function Importador() {
  const [entidade, setEntidade] = useState<Entidade>('contato')
  const [texto, setTexto] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mapa, setMapa] = useState<Mapeamento>({})
  const [chaveDedup, setChaveDedup] = useState('')
  const [funilId, setFunilId] = useState('')
  const [etapaId, setEtapaId] = useState('')
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    
    
    
    
    
    const conteudo = decodificarCsv(new Uint8Array(await f.arrayBuffer()))
    setTexto(conteudo); setRelatorio(null); setErro(null)
    iniciar(async () => {
      const r = await previewImportacao({ entidade, texto: conteudo })
      if ('erro' in r) { setErro(ERRO_PT[r.erro] ?? 'Não foi possível ler o arquivo.'); setPreview(null); return }
      setPreview(r)
      
      
      
      
      
      
      
      
      const auto: Mapeamento = {}
      r.cabecalho.forEach((col, i) => {
        const d = r.destinos.find((x) => normalizar(x.rotulo) === normalizar(col))
        if (d) auto[i] = d.valor
      })
      setMapa(auto)
      
      
      const padrao = r.funis.find((f) => f.is_padrao) ?? r.funis[0]
      setFunilId(padrao?.id ?? '')
      setEtapaId(padrao?.etapas[0]?.id ?? '')
    })
  }

  
  function trocarFunil(id: string) {
    setFunilId(id)
    const f = preview?.funis.find((x) => x.id === id)
    setEtapaId(f?.etapas[0]?.id ?? '')
  }

  function importar() {
    setErro(null)
    iniciar(async () => {
      const r = await executarImportacao({
        entidade, texto, mapa,
        chaveDedup: chaveDedup || undefined,
        funilId: funilId || undefined,
        etapaId: etapaId || undefined,
      })
      if ('erro' in r) { setErro(ERRO_PT[r.erro] ?? 'Não foi possível importar.'); return }
      setRelatorio(r)
    })
  }

  function baixarErros() {
    if (!relatorio) return
    const csv = paraCsv([['Linha', 'Motivo'], ...relatorio.erros.map((e) => [String(e.linha), e.motivo])])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'erros-importacao.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  
  
  
  
  const chavesDisponiveis = preview
    ? preview.chavesDedup.filter((d) => Object.values(mapa).includes(d.valor))
    : []
  const funilEscolhido = preview?.funis.find((f) => f.id === funilId)

  return (
    <section className={estilos.cartao}>
      {}
      <p className={estilos.etapa}>1 · O arquivo</p>
      <div className={estilos.linha}>
        <label className={estilos.rotulo} htmlFor="imp-entidade">O que você vai importar</label>
        <Selecao id="imp-entidade" value={entidade} disabled={pendente}
          onChange={(e) => { setEntidade(e.target.value as Entidade); setPreview(null); setRelatorio(null) }}>
          <option value="contato">Contatos</option>
          <option value="empresa">Empresas</option>
          <option value="negocio">Negócios</option>
        </Selecao>
      </div>

      <label className={estilos.upload}>
        <Upload size={18} strokeWidth={1.75} />
        <span>Escolher arquivo CSV</span>
        <input type="file" accept=".csv,text/csv" hidden disabled={pendente} onChange={aoEscolherArquivo} />
      </label>

      {erro && <p className={estilos.erro}>{erro}</p>}

      {preview && !relatorio && (
        <>
          <p className={estilos.etapa}>2 · O que cada coluna significa</p>
          <p className={estilos.ajuda}>
            <strong>{preview.total}</strong> linha(s) no arquivo. Diga o que cada coluna significa —
            deixe em “Ignorar” o que não quiser trazer.
          </p>

          <div className={estilos.mapaGrade}>
            {preview.cabecalho.map((col, i) => (
              <div key={i} className={estilos.mapaItem}>
                <span className={estilos.mapaColuna}>{col || `(coluna ${i + 1})`}</span>
                <Selecao value={mapa[i] ?? ''} disabled={pendente}
                  aria-label={`Destino da coluna ${col || i + 1}`}
                  onChange={(e) => setMapa((m) => {
                    const novo = { ...m }
                    if (e.target.value) novo[i] = e.target.value; else delete novo[i]
                    return novo
                  })}>
                  <option value="">Ignorar</option>
                  {preview.destinos.map((d) => <option key={d.valor} value={d.valor}>{d.rotulo}</option>)}
                </Selecao>
              </div>
            ))}
          </div>

          {chavesDisponiveis.length > 0 && (
            <div className={estilos.linha}>
              <label className={estilos.rotulo} htmlFor="imp-dedup">Evitar duplicados por</label>
              {}
              <Selecao id="imp-dedup" value={chaveDedup} disabled={pendente}
                onChange={(e) => setChaveDedup(e.target.value)}>
                <option value="">Não verificar (cria tudo)</option>
                {chavesDisponiveis.map((d) => (
                  <option key={d.valor} value={d.valor}>{d.rotulo}</option>
                ))}
              </Selecao>
            </div>
          )}

          {}
          {entidade === 'negocio' && preview.funis.length > 0 && (
            <>
              <div className={estilos.linha}>
                <label className={estilos.rotulo} htmlFor="imp-funil">Importar para o funil</label>
                <Selecao id="imp-funil" value={funilId} disabled={pendente}
                  onChange={(e) => trocarFunil(e.target.value)}>
                  {preview.funis.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}{f.is_padrao ? ' (padrão)' : ''}</option>
                  ))}
                </Selecao>
              </div>
              <div className={estilos.linha}>
                <label className={estilos.rotulo} htmlFor="imp-etapa">Na etapa</label>
                <Selecao id="imp-etapa" value={etapaId} disabled={pendente}
                  onChange={(e) => setEtapaId(e.target.value)}>
                  {(funilEscolhido?.etapas ?? []).map((et) => (
                    <option key={et.id} value={et.id}>{et.nome}</option>
                  ))}
                </Selecao>
              </div>
            </>
          )}

          <p className={estilos.etapa}>3 · Confira e importe</p>
          <div className={estilos.previaRolagem}>
            <table className={estilos.previa}>
              <thead><tr>{preview.cabecalho.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody>
                {preview.amostra.map((l, i) => (
                  <tr key={i}>{preview.cabecalho.map((_, j) => <td key={j}>{l[j] ?? ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <Botao variante="primario" type="button" carregando={pendente} desabilitado={Object.keys(mapa).length === 0}
            onClick={importar}>
            {pendente ? 'Importando…' : `Importar ${preview.total} linha(s)`}
          </Botao>
        </>
      )}

      {relatorio && (
        <div className={estilos.relatorio}>
          <p className={estilos.etapa}>Resultado</p>
          <p className={estilos.relatorioResumo}>
            <strong>{relatorio.criados}</strong> criado(s) · <strong>{relatorio.atualizados}</strong> atualizado(s) ·{' '}
            <strong>{relatorio.erros.length}</strong> com erro
          </p>
          {relatorio.erros.length > 0 && (
            <>
              <ul className={estilos.erroLista}>
                {relatorio.erros.slice(0, 10).map((e) => (
                  <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>
                ))}
              </ul>
              {relatorio.erros.length > 10 && (
                <p className={estilos.ajuda}>…e mais {relatorio.erros.length - 10}.</p>
              )}
              <Botao variante="fantasma" tamanho="pequeno" type="button" onClick={baixarErros}>
                Baixar relatório de erros (CSV)
              </Botao>
            </>
          )}
        </div>
      )}
    </section>
  )
}
