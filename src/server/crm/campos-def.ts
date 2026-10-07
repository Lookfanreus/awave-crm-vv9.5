'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { admin } from '@/server/supabase'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { slugCampo } from '@/lib/slug'
import { lerDefs } from '@/server/crm/campos-leitura'
import { TIPOS_CAMPO, type TipoCampo, type OpcaoCampo, type DefCampo } from '@/lib/campos-valor'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { detalheSeguro } from '@/lib/sanitizar-erro'



export type Entidade = 'negocio' | 'contato' | 'empresa'


type Res = { ok: true; id?: string } | { erro: string }

export type CampoCompleto = {
  id: string; pipeline_id: string | null; entidade: Entidade
  slug: string; rotulo: string; tipo: TipoCampo
  opcoes: OpcaoCampo[]; config: Record<string, unknown>
  ordem: number; ativo: boolean
  uso: number
}

const TABELA: Record<Entidade, string> = { negocio: 'negocios', contato: 'contatos', empresa: 'empresas' }
const TIPOS_COM_OPCOES: TipoCampo[] = ['selecao_unica', 'selecao_multipla']
const RE_SLUG = /^[a-z0-9_]+$/
const MAX_OPCOES = 200
const MAX_ROTULO_OPCAO = 100


function validarOpcoes(opcoes: OpcaoCampo[]): string | null {
  if (opcoes.length > MAX_OPCOES) return 'opcoes_demais'
  const vistos = new Set<string>()
  for (const o of opcoes) {
    if (!o.id?.trim() || !o.rotulo?.trim()) return 'opcao_invalida'
    if (o.rotulo.length > MAX_ROTULO_OPCAO || o.id.length > MAX_ROTULO_OPCAO) return 'opcao_invalida'
    if (vistos.has(o.id)) return 'opcao_repetida'
    vistos.add(o.id)
  }
  return null
}

async function sessaoEws() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  return { cliente, ws }
}

type Cli = Awaited<ReturnType<typeof criarClienteServidor>>


async function contarUso(cliente: Cli, ws: string, entidade: Entidade, slug: string): Promise<number | null> {
  if (!RE_SLUG.test(slug)) return null
  const { count } = await cliente.from(TABELA[entidade])
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ws)
    .not(`campos->>${slug}`, 'is', null)
  return count ?? 0
}

export async function listarCampos(entidade: Entidade): Promise<CampoCompleto[]> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return []
  const { data, error } = await cliente.from('campos_def')
    .select('id, pipeline_id, entidade, slug, rotulo, tipo, opcoes, config, ordem, ativo')
    .eq('workspace_id', ws).eq('entidade', entidade).order('ordem')
  if (error) throw error
  const campos = (data as Omit<CampoCompleto, 'uso'>[] | null) ?? []
  
  
  const usos = await Promise.all(campos.map((c) => contarUso(cliente, ws, entidade, c.slug)))
  return campos.map((c, i) => ({ ...c, uso: usos[i] ?? 0 }))
}


export async function defsParaValidacao(entidade: Entidade, pipelineId?: string): Promise<DefCampo[]> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return []
  return lerDefs(cliente, ws, entidade, pipelineId)
}

export async function criarCampo(input: {
  entidade: Entidade; rotulo: string; tipo: TipoCampo
  pipelineId?: string | null; opcoes?: OpcaoCampo[]
}): Promise<Res> {
  await exigirEngineLiberado()
  const rotulo = input.rotulo.trim()
  if (!rotulo) return { erro: 'rotulo_vazio' }
  if (!TIPOS_CAMPO.includes(input.tipo)) return { erro: 'tipo_invalido' }
  const precisaOpcoes = TIPOS_COM_OPCOES.includes(input.tipo)
  if (precisaOpcoes && !(input.opcoes?.length)) return { erro: 'opcoes_obrigatorias' }
  if (input.opcoes?.length) {
    const problema = validarOpcoes(input.opcoes)
    if (problema) return { erro: problema }
  }

  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: existentes } = await cliente.from('campos_def')
      .select('slug, ordem').eq('workspace_id', ws).eq('entidade', input.entidade)
    const linhas = (existentes as { slug: string; ordem: number }[] | null) ?? []
    const slug = slugCampo(rotulo, linhas.map((l) => l.slug))
    const ordem = linhas.reduce((max, l) => Math.max(max, l.ordem), -1) + 1
    const { data, error } = await admin().from('campos_def').insert({
      workspace_id: ws, entidade: input.entidade, pipeline_id: input.pipelineId ?? null,
      slug, rotulo, tipo: input.tipo, opcoes: input.opcoes ?? [], config: {}, ordem, ativo: true,
    }).select('id').single()
    if (error) throw error
    return { ok: true, id: (data as { id: string }).id }
  } catch (err) { console.error('[campos] criar', detalheSeguro(err)); return { erro: 'falha_criar' } }
}


export async function renomearCampo({ id, rotulo }: { id: string; rotulo: string }): Promise<Res> {
  await exigirEngineLiberado()
  const limpo = rotulo.trim()
  if (!limpo) return { erro: 'rotulo_vazio' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: c } = await cliente.from('campos_def')
      .select('id, slug').eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (!c) return { erro: 'nao_encontrado' }
    const { error } = await admin().from('campos_def')
      .update({ rotulo: limpo }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[campos] renomear', detalheSeguro(err)); return { erro: 'falha_renomear' } }
}

export async function editarOpcoes({ id, opcoes }: { id: string; opcoes: OpcaoCampo[] }): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: c } = await cliente.from('campos_def')
      .select('id, tipo').eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (!c) return { erro: 'nao_encontrado' }
    if (!TIPOS_COM_OPCOES.includes((c as { tipo: TipoCampo }).tipo)) return { erro: 'tipo_sem_opcoes' }
    const problema = validarOpcoes(opcoes)
    if (problema) return { erro: problema }
    const { error } = await admin().from('campos_def')
      .update({ opcoes }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[campos] opcoes', detalheSeguro(err)); return { erro: 'falha_opcoes' } }
}

async function setAtivo(id: string, ativo: boolean, tag: string): Promise<Res> {
  const { ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { error } = await admin().from('campos_def')
      .update({ ativo }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error(`[campos] ${tag}`, detalheSeguro(err)); return { erro: `falha_${tag}` } }
}




export async function arquivarCampo({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  return setAtivo(id, false, 'arquivar')
}
export async function reativarCampo({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  return setAtivo(id, true, 'reativar')
}


export async function excluirCampo({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: c } = await cliente.from('campos_def')
      .select('id, slug, entidade').eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (!c) return { erro: 'nao_encontrado' }
    const campo = c as { slug: string; entidade: Entidade }
    const uso = await contarUso(cliente, ws, campo.entidade, campo.slug)
    if (uso === null) return { erro: 'slug_invalido' }
    if (uso > 0) return { erro: 'em_uso' }
    const { error } = await admin().from('campos_def')
      .delete().eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[campos] excluir', detalheSeguro(err)); return { erro: 'falha_excluir' } }
}
