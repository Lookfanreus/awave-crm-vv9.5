'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { admin } from '@/server/supabase'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { assertMesmoPipeline } from '@/server/crm/kanban-ordem'
import { logEtapaMudou } from '@/server/crm/timeline'
import { camposNegocio, camposContato, camposEmpresa } from '@/server/crm/campos'
import { slugCanonico } from '@/server/crm/agenda'
import { resolverMembroAtivo } from '@/server/auth/membro-ativo'
import { listarPessoas, type Pessoa } from '@/server/crm/pessoas'
import { mesclarCampos } from '@/server/crm/campos-leitura'
import { regrasDaEtapa } from '@/server/crm/campos-etapa'
import { camposFaltantes, avancou } from '@/lib/gate-campos'
import type { Entidade } from '@/server/crm/campos-def'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { detalheSeguro } from '@/lib/sanitizar-erro'

type Res = { ok: true; id?: string } | { erro: string }

async function sessaoEws() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  return { cliente, ws }
}

export async function salvarContato(input: {
  id?: string; nome?: string; email?: string | null; telefone?: string | null
  origem?: string | null; notas?: string | null; empresa_id?: string | null
}): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  const campos = camposContato(input)
  try {
    if (input.id) {
      const { error } = await admin().from('contatos').update(campos).eq('id', input.id).eq('workspace_id', ws)
      if (error) throw error
      return { ok: true, id: input.id }
    }
    if (!campos.nome) return { erro: 'nome_obrigatorio' }
    const { data, error } = await admin().from('contatos').insert({ ...campos, workspace_id: ws }).select('id').single()
    if (error) throw error
    return { ok: true, id: (data as { id: string }).id }
  } catch { return { erro: 'falha_salvar' } }
}

export async function salvarEmpresa(input: {
  id?: string; nome?: string; site?: string | null; telefone?: string | null; notas?: string | null
}): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  const campos = camposEmpresa(input)
  try {
    if (input.id) {
      const { error } = await admin().from('empresas').update(campos).eq('id', input.id).eq('workspace_id', ws)
      if (error) throw error
      return { ok: true, id: input.id }
    }
    if (!campos.nome) return { erro: 'nome_obrigatorio' }
    const { data, error } = await admin().from('empresas').insert({ ...campos, workspace_id: ws }).select('id').single()
    if (error) throw error
    return { ok: true, id: (data as { id: string }).id }
  } catch { return { erro: 'falha_salvar' } }
}

export async function salvarNegocio(input: {
  id?: string; titulo?: string; valor?: number | string | null
  contato_id?: string | null; empresa_id?: string | null; pipeline_id?: string
  
  previsao_fechamento?: string | null
  
  responsavel_id?: string | null
}): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  const campos = camposNegocio(input)
  try {
    
    
    
    
    if (typeof input.responsavel_id === 'string' && input.responsavel_id) {
      const { data: m, error: eM } = await cliente.from('membros')
        .select('id').eq('workspace_id', ws).eq('id', input.responsavel_id).maybeSingle()
      if (eM) throw eM
      if (!m) return { erro: 'responsavel_invalido' }
    }

    if (input.id) {
      const { error } = await admin().from('negocios').update(campos).eq('id', input.id).eq('workspace_id', ws)
      if (error) throw error
      return { ok: true, id: input.id }
    }
    if (!campos.titulo) return { erro: 'titulo_obrigatorio' }

    
    
    
    
    
    
    
    
    
    
    if (campos.responsavel_id === undefined) {
      const membroId = await resolverMembroAtivo({ cliente, ws })
      
      
      
      if (membroId) campos.responsavel_id = membroId
    }
    
    let pipeId: string
    if (input.pipeline_id) {
      const { data: p, error: ep } = await cliente.from('pipelines')
        .select('id').eq('workspace_id', ws).eq('id', input.pipeline_id).maybeSingle()
      if (ep) throw ep
      if (!p) return { erro: 'pipeline_invalido' }
      pipeId = (p as { id: string }).id
    } else {
      const { data: pipe, error: e1 } = await cliente.from('pipelines')
        .select('id').eq('workspace_id', ws).eq('is_padrao', true).maybeSingle()
      if (e1) throw e1
      if (!pipe) return { erro: 'sem_pipeline' }
      pipeId = (pipe as { id: string }).id
    }
    const { data: etapa, error: e2 } = await cliente.from('etapas')
      .select('id').eq('workspace_id', ws).eq('pipeline_id', pipeId)
      .order('ordem', { ascending: true }).limit(1).maybeSingle()
    if (e2) throw e2
    if (!etapa) return { erro: 'sem_etapa' }
    const etapaId = (etapa as { id: string }).id
    const { data: ult, error: e3 } = await cliente.from('negocios')
      .select('ordem').eq('workspace_id', ws).eq('etapa_id', etapaId)
      .order('ordem', { ascending: false }).limit(1).maybeSingle()
    if (e3) throw e3
    const ordem = ((ult as { ordem: number } | null)?.ordem ?? -1) + 1
    const { data, error } = await admin().from('negocios')
      .insert({ ...campos, etapa_id: etapaId, pipeline_id: pipeId, status: 'aberto', ordem, workspace_id: ws })
      .select('id').single()
    if (error) throw error
    return { ok: true, id: (data as { id: string }).id }
  } catch { return { erro: 'falha_salvar' } }
}

export async function adicionarAtividade(input: {
  tipo: string; conteudo?: string | null; negocioId?: string; contatoId?: string; vencimento?: string | null
}): Promise<Res> {
  await exigirEngineLiberado()
  const TIPOS = ['nota', 'ligacao', 'reuniao', 'tarefa', 'email', 'prazo']
  if (!TIPOS.includes(slugCanonico(input.tipo))) return { erro: 'tipo_invalido' }
  if (!input.negocioId && !input.contatoId) return { erro: 'sem_alvo' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    
    if (input.negocioId) {
      const { data, error: eN } = await cliente.from('negocios').select('id').eq('id', input.negocioId).eq('workspace_id', ws).maybeSingle()
      if (eN) throw eN
      if (!data) return { erro: 'negocio_nao_encontrado' }
    }
    if (input.contatoId) {
      const { data, error: eC } = await cliente.from('contatos').select('id').eq('id', input.contatoId).eq('workspace_id', ws).maybeSingle()
      if (eC) throw eC
      if (!data) return { erro: 'contato_nao_encontrado' }
    }
    const { data: t, error: eT } = await cliente.from('tipos_atividade')
      .select('id').eq('workspace_id', ws).eq('slug', slugCanonico(input.tipo)).maybeSingle()
    if (eT) throw eT
    if (!t) return { erro: 'tipo_invalido' }
    const linha: Record<string, unknown> = {
      workspace_id: ws, tipo_id: (t as { id: string }).id, autor: 'staff', conteudo: input.conteudo ?? null,
      negocio_id: input.negocioId ?? null, contato_id: input.contatoId ?? null,
    }
    
    if (input.vencimento) {
      const membroId = await resolverMembroAtivo({ cliente, ws })
      if (!membroId) return { erro: 'sem_membro' }
      linha.vencimento = input.vencimento
      linha.responsavel_id = membroId
    }
    const { error } = await admin().from('atividades').insert(linha)
    if (error) throw error
    return { ok: true }
  } catch { return { erro: 'falha_atividade' } }
}

export async function mudarEtapa(
  negocioId: string,
  etapaId: string,
): Promise<Res | { erro: string; campos: string[] }> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: neg, error: eNeg } = await cliente.from('negocios').select('pipeline_id, etapa_id, campos').eq('id', negocioId).eq('workspace_id', ws).maybeSingle()
    if (eNeg) throw eNeg
    if (!neg) return { erro: 'negocio_nao_encontrado' }
    const { data: etapa, error: eEtapa } = await cliente.from('etapas').select('pipeline_id, nome, ordem').eq('id', etapaId).eq('workspace_id', ws).maybeSingle()
    if (eEtapa) throw eEtapa
    if (!etapa) return { erro: 'etapa_nao_encontrada' }
    assertMesmoPipeline((neg as { pipeline_id: string }).pipeline_id, (etapa as { pipeline_id: string }).pipeline_id)

    
    const n = neg as { etapa_id: string; campos?: Record<string, unknown> }
    
    
    const { data: origem, error: eOrigem } = await cliente.from('etapas')
      .select('ordem').eq('workspace_id', ws).eq('id', n.etapa_id).maybeSingle()
    if (eOrigem) throw eOrigem
    const ordemOrigem = (origem as { ordem: number } | null)?.ordem ?? 0
    if (avancou(ordemOrigem, (etapa as { ordem: number }).ordem)) {
      const { obrigatorios, rotulos } = await regrasDaEtapa(n.etapa_id)
      const faltando = camposFaltantes(obrigatorios, n.campos ?? {})
      if (faltando.length) return { erro: 'campos_obrigatorios', campos: faltando.map((s) => rotulos[s] ?? s) }
    }
    const { data: ult, error: eUlt } = await cliente.from('negocios')
      .select('ordem').eq('workspace_id', ws).eq('etapa_id', etapaId)
      .order('ordem', { ascending: false }).limit(1).maybeSingle()
    if (eUlt) throw eUlt
    const ordem = ((ult as { ordem: number } | null)?.ordem ?? -1) + 1
    const { error } = await admin().from('negocios').update({ etapa_id: etapaId, ordem }).eq('id', negocioId).eq('workspace_id', ws)
    if (error) throw error
    await logEtapaMudou(admin(), ws, negocioId, (etapa as { nome: string }).nome)
    return { ok: true }
  } catch { return { erro: 'falha_mudar_etapa' } }
}

export async function opcoesForm(): Promise<{
  contatos: { id: string; nome: string }[]
  empresas: { id: string; nome: string }[]
  funis: { id: string; nome: string; is_padrao: boolean }[]
  pessoas: Pessoa[]
}> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { contatos: [], empresas: [], funis: [], pessoas: [] }
  
  
  
  
  
  
  const [c, e, f, pessoas] = await Promise.all([
    cliente.from('contatos').select('id, nome').eq('workspace_id', ws).order('nome').limit(200),
    cliente.from('empresas').select('id, nome').eq('workspace_id', ws).order('nome').limit(200),
    cliente.from('pipelines').select('id, nome, is_padrao').eq('workspace_id', ws).order('ordem'),
    listarPessoas(),
  ])
  return {
    contatos: (c.data as { id: string; nome: string }[] | null) ?? [],
    empresas: (e.data as { id: string; nome: string }[] | null) ?? [],
    funis: (f.data as { id: string; nome: string; is_padrao: boolean }[] | null) ?? [],
    pessoas,
  }
}

const TABELA_ENTIDADE: Record<Entidade, string> = {
  negocio: 'negocios', contato: 'contatos', empresa: 'empresas',
}


export async function salvarCampos({ entidade, id, patch }: {
  entidade: Entidade; id: string; patch: Record<string, unknown>
}): Promise<{ ok: true } | { erro: string; slugs?: string[] }> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  const tabela = TABELA_ENTIDADE[entidade]
  try {
    const colunas = entidade === 'negocio' ? 'campos, pipeline_id' : 'campos'
    const { data: atualRow, error: e1 } = await cliente.from(tabela)
      .select(colunas).eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (e1) throw e1
    if (!atualRow) return { erro: 'nao_encontrado' }
    const linha = atualRow as unknown as { campos?: Record<string, unknown>; pipeline_id?: string }

    const r = await mesclarCampos(
      cliente, ws, entidade, linha.campos ?? {}, patch,
      entidade === 'negocio' ? linha.pipeline_id : undefined,
    )
    if (!r.ok) return { erro: 'campo_invalido', slugs: r.slugs }

    const { error: e2 } = await admin().from(tabela)
      .update({ campos: r.campos }).eq('workspace_id', ws).eq('id', id)
    if (e2) throw e2
    return { ok: true }
  } catch (err) { console.error('[campos] salvar', detalheSeguro(err)); return { erro: 'falha_salvar' } }
}


export async function mudarFunil(negocioId: string, funilId: string): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: neg, error: e1 } = await cliente.from('negocios')
      .select('pipeline_id').eq('id', negocioId).eq('workspace_id', ws).maybeSingle()
    if (e1) throw e1
    if (!neg) return { erro: 'negocio_nao_encontrado' }
    if ((neg as { pipeline_id: string }).pipeline_id === funilId) return { ok: true }  
    const { data: funil, error: e2 } = await cliente.from('pipelines')
      .select('id').eq('id', funilId).eq('workspace_id', ws).maybeSingle()
    if (e2) throw e2
    if (!funil) return { erro: 'funil_nao_encontrado' }
    const { data: etapa, error: e3 } = await cliente.from('etapas')
      .select('id, nome').eq('workspace_id', ws).eq('pipeline_id', funilId)
      .order('ordem', { ascending: true }).limit(1).maybeSingle()
    if (e3) throw e3
    if (!etapa) return { erro: 'funil_sem_etapa' }
    const et = etapa as { id: string; nome: string }
    const { data: ult, error: e4 } = await cliente.from('negocios')
      .select('ordem').eq('workspace_id', ws).eq('etapa_id', et.id)
      .order('ordem', { ascending: false }).limit(1).maybeSingle()
    if (e4) throw e4
    const ordem = ((ult as { ordem: number } | null)?.ordem ?? -1) + 1
    const { error: e5 } = await admin().from('negocios')
      .update({ pipeline_id: funilId, etapa_id: et.id, ordem }).eq('id', negocioId).eq('workspace_id', ws)
    if (e5) throw e5
    await logEtapaMudou(admin(), ws, negocioId, et.nome)
    return { ok: true }
  } catch { return { erro: 'falha_mudar_funil' } }
}
