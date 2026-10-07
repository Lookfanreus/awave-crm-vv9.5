'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { admin } from '@/server/supabase'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { lerDefsUI, type DefCampoUI } from '@/server/crm/campos-leitura'
import { parseCsv } from '@/lib/csv'
import { planejar, LIMITE_LINHAS, type Mapeamento, type LinhaPlano } from '@/lib/importacao'
import type { Entidade } from '@/server/crm/campos-def'
import type { TipoCampo } from '@/lib/campos-valor'
import { exigirEngineLiberado } from '@/server/license/exigir'



const LOTE = 200


const FIXOS: Record<Entidade, { nome: string; rotulo: string }[]> = {
  contato: [
    { nome: 'nome', rotulo: 'Nome' }, { nome: 'email', rotulo: 'E-mail' },
    { nome: 'telefone', rotulo: 'Telefone' }, { nome: 'origem', rotulo: 'Origem' },
    { nome: 'notas', rotulo: 'Notas' },
  ],
  empresa: [
    { nome: 'nome', rotulo: 'Nome' }, { nome: 'site', rotulo: 'Site' },
    { nome: 'telefone', rotulo: 'Telefone' }, { nome: 'notas', rotulo: 'Notas' },
  ],
  negocio: [
    { nome: 'titulo', rotulo: 'Título' }, { nome: 'valor', rotulo: 'Valor' },
  ],
}

const TABELA: Record<Entidade, string> = { negocio: 'negocios', contato: 'contatos', empresa: 'empresas' }
const OBRIGATORIO: Record<Entidade, string> = { negocio: 'titulo', contato: 'nome', empresa: 'nome' }


const TIPOS_DEDUP: TipoCampo[] = ['texto', 'email', 'telefone', 'documento', 'numero']


type ChaveDedup = { tipo: 'fixo'; nome: string } | { tipo: 'campo'; slug: string }


function chaveTemForma(bruto: string, entidade: Entidade): boolean {
  if (bruto.startsWith('fixo:')) return FIXOS[entidade].some((f) => f.nome === bruto.slice(5))
  return bruto.startsWith('campo:') && bruto.length > 'campo:'.length
}


function resolverChaveDedup(bruto: string, entidade: Entidade, defs: DefCampoUI[]): ChaveDedup | null {
  if (bruto.startsWith('fixo:')) {
    const nome = bruto.slice(5)
    return FIXOS[entidade].some((f) => f.nome === nome) ? { tipo: 'fixo', nome } : null
  }
  const slug = bruto.slice(6)
  const def = defs.find((d) => d.slug === slug)
  if (!def || !TIPOS_DEDUP.includes(def.tipo)) return null
  return { tipo: 'campo', slug }
}


function chaveDaLinha(item: LinhaPlano, chave: ChaveDedup): string {
  const v = chave.tipo === 'fixo' ? item.fixos[chave.nome] : item.campos[chave.slug]
  return String(v ?? '')
}

async function sessaoEws() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  return { cliente, ws }
}

type Cli = Awaited<ReturnType<typeof criarClienteServidor>>

export type EtapaDoFunil = { id: string; nome: string }
export type FunilDaImportacao = { id: string; nome: string; is_padrao: boolean; etapas: EtapaDoFunil[] }

export type Preview = {
  cabecalho: string[]
  amostra: string[][]
  total: number
  destinos: { valor: string; rotulo: string }[]
  
  funis: FunilDaImportacao[]
  
  chavesDedup: { valor: string; rotulo: string }[]
}


async function funisDoWorkspace(cliente: Cli, ws: string): Promise<FunilDaImportacao[]> {
  const { data: pipes, error: e1 } = await cliente.from('pipelines')
    .select('id, nome, is_padrao').eq('workspace_id', ws).order('ordem')
  if (e1) throw e1
  const funis = ((pipes ?? []) as { id: string; nome: string; is_padrao: boolean }[])
  if (funis.length === 0) return []

  const { data: etapas, error: e2 } = await cliente.from('etapas')
    .select('id, nome, pipeline_id').eq('workspace_id', ws).order('ordem')
  if (e2) throw e2

  const porFunil = new Map<string, EtapaDoFunil[]>()
  for (const e of ((etapas ?? []) as { id: string; nome: string; pipeline_id: string }[])) {
    const arr = porFunil.get(e.pipeline_id) ?? []
    arr.push({ id: e.id, nome: e.nome })
    porFunil.set(e.pipeline_id, arr)
  }
  return funis.map((f) => ({ ...f, etapas: porFunil.get(f.id) ?? [] }))
}


export async function previewImportacao(
  { entidade, texto }: { entidade: Entidade; texto: string },
): Promise<Preview | { erro: string }> {
  const linhas = parseCsv(texto)
  if (linhas.length < 2) return { erro: 'arquivo_vazio' }
  if (linhas.length - 1 > LIMITE_LINHAS) return { erro: 'arquivo_grande' }

  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  const defs = await lerDefsUI(cliente, ws, entidade)

  return {
    cabecalho: linhas[0],
    amostra: linhas.slice(1, 11),
    total: linhas.length - 1,
    destinos: [
      ...FIXOS[entidade].map((f) => ({ valor: `fixo:${f.nome}`, rotulo: f.rotulo })),
      ...defs.map((d) => ({ valor: `campo:${d.slug}`, rotulo: d.rotulo })),
    ],
    funis: entidade === 'negocio' ? await funisDoWorkspace(cliente, ws) : [],
    chavesDedup: [
      ...FIXOS[entidade].map((f) => ({ valor: `fixo:${f.nome}`, rotulo: f.rotulo })),
      ...defs
        .filter((d) => TIPOS_DEDUP.includes(d.tipo))
        .map((d) => ({ valor: `campo:${d.slug}`, rotulo: d.rotulo })),
    ],
  }
}

export async function executarImportacao({ entidade, texto, mapa, chaveDedup, funilId, etapaId }: {
  entidade: Entidade; texto: string; mapa: Mapeamento; chaveDedup?: string
  
  funilId?: string; etapaId?: string
}): Promise<{ criados: number; atualizados: number; erros: { linha: number; motivo: string }[] } | { erro: string }> {
  await exigirEngineLiberado()
  const linhas = parseCsv(texto)
  if (linhas.length < 2) return { erro: 'arquivo_vazio' }
  if (linhas.length - 1 > LIMITE_LINHAS) return { erro: 'arquivo_grande' }

  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }

  
  
  
  
  if (chaveDedup && !chaveTemForma(chaveDedup, entidade)) return { erro: 'chave_invalida' }

  const defs = await lerDefsUI(cliente, ws, entidade)

  const chave = chaveDedup ? resolverChaveDedup(chaveDedup, entidade, defs) : null
  if (chaveDedup && !chave) return { erro: 'chave_invalida' }

  const plano = planejar(linhas, mapa, defs, FIXOS[entidade].map((f) => f.nome))

  const erros: { linha: number; motivo: string }[] = []
  let criados = 0, atualizados = 0
  const tabela = TABELA[entidade]
  const campoObrigatorio = OBRIGATORIO[entidade]

  
  
  
  
  
  
  let posicional: Record<string, unknown> = {}
  if (entidade === 'negocio') {
    let pipelineId: string
    if (funilId) {
      
      
      
      const { data: pipe } = await cliente.from('pipelines')
        .select('id').eq('workspace_id', ws).eq('id', funilId).maybeSingle()
      if (!pipe) return { erro: 'funil_invalido' }
      pipelineId = (pipe as { id: string }).id
    } else {
      const { data: pipe } = await cliente.from('pipelines')
        .select('id').eq('workspace_id', ws).eq('is_padrao', true).maybeSingle()
      if (!pipe) return { erro: 'sem_pipeline' }
      pipelineId = (pipe as { id: string }).id
    }

    let etapaFinal: string
    if (etapaId) {
      
      
      
      
      
      
      const { data: et } = await cliente.from('etapas')
        .select('id').eq('workspace_id', ws).eq('id', etapaId).eq('pipeline_id', pipelineId).maybeSingle()
      if (!et) return { erro: 'etapa_invalida' }
      etapaFinal = (et as { id: string }).id
    } else {
      const { data: et } = await cliente.from('etapas')
        .select('id').eq('workspace_id', ws).eq('pipeline_id', pipelineId)
        .order('ordem', { ascending: true }).limit(1).maybeSingle()
      if (!et) return { erro: 'sem_etapa' }
      etapaFinal = (et as { id: string }).id
    }
    posicional = { pipeline_id: pipelineId, etapa_id: etapaFinal, status: 'aberto' }
  }

  for (let i = 0; i < plano.length; i += LOTE) {
    const lote = plano.slice(i, i + LOTE)

    
    const validas: LinhaPlano[] = []
    for (const item of lote) {
      if (item.erros.length) { erros.push({ linha: item.indice, motivo: item.erros.join('; ') }); continue }
      if (!item.fixos[campoObrigatorio]) {
        erros.push({ linha: item.indice, motivo: `${campoObrigatorio} é obrigatório` }); continue
      }
      validas.push(item)
    }
    if (validas.length === 0) continue

    
    
    
    const existentes = new Map<string, { id: string; campos?: Record<string, unknown> }>()
    if (chave) {
      const valores = [...new Set(validas.map((v) => chaveDaLinha(v, chave)).filter(Boolean))]
      if (valores.length > 0) {
        
        
        
        
        
        
        const coluna = chave.tipo === 'fixo' ? chave.nome : `campos->>${chave.slug}`
        const selecao = chave.tipo === 'fixo' ? `id, campos, ${chave.nome}` : 'id, campos'
        const { data } = await cliente.from(tabela)
          .select(selecao).eq('workspace_id', ws).in(coluna, valores)
        for (const linha of ((data ?? []) as unknown) as Array<Record<string, unknown>>) {
          
          
          const bruta = chave.tipo === 'fixo'
            ? linha[chave.nome]
            : (linha.campos as Record<string, unknown> | null)?.[chave.slug]
          existentes.set(String(bruta ?? ''), {
            id: linha.id as string,
            campos: linha.campos as Record<string, unknown> | undefined,
          })
        }
      }
    }

    const paraInserir = validas.filter((v) => !chave || !existentes.has(chaveDaLinha(v, chave)))
    const paraAtualizar = validas.filter((v) => chave && existentes.has(chaveDaLinha(v, chave)))

    
    
    if (paraInserir.length > 0) {
      const linhas = paraInserir.map((v) => ({ ...v.fixos, ...posicional, campos: v.campos, workspace_id: ws }))
      const { error } = await admin().from(tabela).insert(linhas)
      if (!error) {
        criados += paraInserir.length
      } else {
        for (const v of paraInserir) {
          const { error: e1 } = await admin().from(tabela)
            .insert({ ...v.fixos, ...posicional, campos: v.campos, workspace_id: ws })
          if (e1) { console.error('[importar] linha', v.indice, e1); erros.push({ linha: v.indice, motivo: 'falha ao gravar' }) }
          else criados++
        }
      }
    }

    
    for (const v of paraAtualizar) {
      const alvo = existentes.get(chaveDaLinha(v, chave!))!
      const { error } = await admin().from(tabela)
        .update({ ...v.fixos, campos: { ...(alvo.campos ?? {}), ...v.campos } })
        .eq('workspace_id', ws).eq('id', alvo.id)
      if (error) { console.error('[importar] linha', v.indice, error); erros.push({ linha: v.indice, motivo: 'falha ao gravar' }) }
      else atualizados++
    }
  }
  return { criados, atualizados, erros }
}

