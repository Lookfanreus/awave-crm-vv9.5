import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerDefsUI, type DefCampoUI } from '@/server/crm/campos-leitura'
import { lerRegrasEtapa } from '@/server/crm/campos-leitura'







export type AtividadeTimeline = {
  id: string
  tipo: { slug: string; nome: string; icone: string; natureza: string }
  conteudo: string | null
  autor: string
  criado_em: string
  vencimento: string | null
  concluida_em: string | null
  responsavel_id: string | null
}

export type NegocioRelacionado = {
  id: string
  titulo: string
  valor: string | null
  status: string
}

export type NegocioDetalhe = {
  id: string
  titulo: string
  valor: string | null
  status: string
  motivo_perda: string | null
  etapaId: string
  etapaNome: string | null
  pipelineId: string
  contatoId: string | null
  contatoNome: string | null
  empresaId: string | null
  empresaNome: string | null
  
  previsaoFechamento: string | null
  
  responsavelId: string | null
  etapas: { id: string; nome: string; ordem: number }[]
  atividades: AtividadeTimeline[]
  
  campos: Record<string, unknown>
  camposDef: DefCampoUI[]
  camposObrigatorios: string[]
}

export type ContatoDetalhe = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  origem: string | null
  notas: string | null
  empresaId: string | null
  empresaNome: string | null
  atividades: AtividadeTimeline[]
  negocios: NegocioRelacionado[]
  campos: Record<string, unknown>
  camposDef: DefCampoUI[]
  camposObrigatorios: string[]
}

export type EmpresaDetalhe = {
  id: string
  nome: string
  site: string | null
  telefone: string | null
  notas: string | null
  contatos: { id: string; nome: string; email: string | null }[]
  negocios: NegocioRelacionado[]
  campos: Record<string, unknown>
  camposDef: DefCampoUI[]
  camposObrigatorios: string[]
}






function nomeEmbed(x: unknown): string | null {
  if (!x) return null
  const o = Array.isArray(x) ? x[0] : x
  return (o as { nome?: string } | undefined)?.nome ?? null
}


function tipoEmbed(x: unknown): AtividadeTimeline['tipo'] {
  const o = (Array.isArray(x) ? x[0] : x) as AtividadeTimeline['tipo'] | undefined
  return o ?? { slug: 'nota', nome: 'Nota', icone: 'StickyNote', natureza: 'nota' }
}


function mapTimeline(rows: unknown): AtividadeTimeline[] {
  return ((rows ?? []) as unknown as Record<string, unknown>[])
    .map((a) => ({ ...a, tipo: tipoEmbed(a.tipo) })) as AtividadeTimeline[]
}





export async function carregarNegocio(
  cliente: SupabaseClient,
  ws: string,
  id: string,
): Promise<NegocioDetalhe | null> {
  
  const { data: neg, error: e1 } = await cliente
    .from('negocios')
    .select('id, titulo, valor, status, motivo_perda, etapa_id, pipeline_id, contato_id, empresa_id, campos, previsao_fechamento, responsavel_id, contatos(nome), empresas(nome)')
    .eq('id', id)
    .eq('workspace_id', ws)
    .maybeSingle()
  if (e1) throw e1
  if (!neg) return null

  const n = neg as Record<string, unknown>

  
  const { data: etapasData, error: e2 } = await cliente
    .from('etapas')
    .select('id, nome, ordem')
    .eq('workspace_id', ws)
    .eq('pipeline_id', n.pipeline_id as string)
    .order('ordem', { ascending: true })
  if (e2) throw e2

  const etapas = ((etapasData ?? []) as { id: string; nome: string; ordem: number }[])
  const etapaNome = etapas.find((e) => e.id === (n.etapa_id as string))?.nome ?? null

  
  const { data: atvsData, error: e3 } = await cliente
    .from('atividades')
    .select('id, conteudo, autor, criado_em, vencimento, concluida_em, responsavel_id, tipo:tipos_atividade!atividades_tipo_fk(slug, nome, icone, natureza)')
    .eq('workspace_id', ws)
    .eq('negocio_id', id)
    .order('criado_em', { ascending: false })
  if (e3) throw e3

  const atividades = mapTimeline(atvsData)

  
  const camposDef = await lerDefsUI(cliente, ws, 'negocio', n.pipeline_id as string)

  
  
  const { obrigatorios, invisiveis } = await lerRegrasEtapa(cliente, ws, n.etapa_id as string)
  const camposVisiveis = camposDef.filter((c) => !invisiveis.includes(c.slug))

  return {
    id: n.id as string,
    titulo: n.titulo as string,
    valor: (n.valor as string | null) ?? null,
    status: n.status as string,
    motivo_perda: (n.motivo_perda as string | null) ?? null,
    etapaId: n.etapa_id as string,
    etapaNome,
    pipelineId: n.pipeline_id as string,
    contatoId: (n.contato_id as string | null) ?? null,
    contatoNome: nomeEmbed(n.contatos),
    empresaId: (n.empresa_id as string | null) ?? null,
    empresaNome: nomeEmbed(n.empresas),
    previsaoFechamento: (n.previsao_fechamento as string | null) ?? null,
    responsavelId: (n.responsavel_id as string | null) ?? null,
    etapas,
    atividades,
    campos: (n.campos as Record<string, unknown> | null) ?? {},
    camposDef: camposVisiveis,
    camposObrigatorios: obrigatorios,
  }
}





export async function carregarContato(
  cliente: SupabaseClient,
  ws: string,
  id: string,
): Promise<ContatoDetalhe | null> {
  
  const { data: contato, error: e1 } = await cliente
    .from('contatos')
    .select('id, nome, email, telefone, origem, notas, empresa_id, campos, empresas(nome)')
    .eq('id', id)
    .eq('workspace_id', ws)
    .maybeSingle()
  if (e1) throw e1
  if (!contato) return null

  const c = contato as Record<string, unknown>

  
  const { data: atvsData, error: e2 } = await cliente
    .from('atividades')
    .select('id, conteudo, autor, criado_em, vencimento, concluida_em, responsavel_id, tipo:tipos_atividade!atividades_tipo_fk(slug, nome, icone, natureza)')
    .eq('workspace_id', ws)
    .eq('contato_id', id)
    .order('criado_em', { ascending: false })
  if (e2) throw e2

  
  const { data: negsData, error: e3 } = await cliente
    .from('negocios')
    .select('id, titulo, valor, status')
    .eq('workspace_id', ws)
    .eq('contato_id', id)
  if (e3) throw e3

  const camposDef = await lerDefsUI(cliente, ws, 'contato')

  return {
    id: c.id as string,
    nome: c.nome as string,
    email: (c.email as string | null) ?? null,
    telefone: (c.telefone as string | null) ?? null,
    origem: (c.origem as string | null) ?? null,
    notas: (c.notas as string | null) ?? null,
    empresaId: (c.empresa_id as string | null) ?? null,
    empresaNome: nomeEmbed(c.empresas),
    atividades: mapTimeline(atvsData),
    negocios: (negsData ?? []) as NegocioRelacionado[],
    campos: (c.campos as Record<string, unknown> | null) ?? {},
    camposDef,
    camposObrigatorios: [],
  }
}





export async function carregarEmpresa(
  cliente: SupabaseClient,
  ws: string,
  id: string,
): Promise<EmpresaDetalhe | null> {
  
  const { data: empresa, error: e1 } = await cliente
    .from('empresas')
    .select('id, nome, site, telefone, notas, campos')
    .eq('id', id)
    .eq('workspace_id', ws)
    .maybeSingle()
  if (e1) throw e1
  if (!empresa) return null

  const em = empresa as Record<string, unknown>

  
  const { data: contData, error: e2 } = await cliente
    .from('contatos')
    .select('id, nome, email')
    .eq('workspace_id', ws)
    .eq('empresa_id', id)
    .order('nome')
  if (e2) throw e2

  
  
  const { data: negsData, error: e3 } = await cliente
    .from('negocios')
    .select('id, titulo, valor, status')
    .eq('workspace_id', ws)
    .eq('empresa_id', id)
  if (e3) throw e3

  const camposDef = await lerDefsUI(cliente, ws, 'empresa')

  return {
    id: em.id as string,
    nome: em.nome as string,
    site: (em.site as string | null) ?? null,
    telefone: (em.telefone as string | null) ?? null,
    notas: (em.notas as string | null) ?? null,
    contatos: (contData ?? []) as { id: string; nome: string; email: string | null }[],
    negocios: (negsData ?? []) as NegocioRelacionado[],
    campos: (em.campos as Record<string, unknown> | null) ?? {},
    camposDef,
    camposObrigatorios: [],
  }
}
