'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { admin } from '@/server/supabase'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { proximaCor, corValida } from '@/lib/cores-etapa'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { detalheSeguro } from '@/lib/sanitizar-erro'



type Res = { ok: true } | { erro: string }
type ResId = { ok: true; id: string } | { erro: string }

export type FunilResumo = { id: string; nome: string; is_padrao: boolean; ordem: number; totalNegocios: number }
export type EtapaEditor = { id: string; nome: string; cor: string | null; ordem: number; totalNegocios: number; sla_dias: number | null; probabilidade: number | null }
export type FunilDetalhe = { id: string; nome: string; is_padrao: boolean; etapas: EtapaEditor[] }


const ETAPAS_PADRAO: { nome: string; cor: string }[] = [
  { nome: 'Novo lead', cor: '#94a3b8' }, { nome: 'Contato feito', cor: '#60a5fa' },
  { nome: 'Proposta', cor: '#a78bfa' }, { nome: 'Negociação', cor: '#fbbf24' },
  { nome: 'Fechamento', cor: '#34d399' },
]

async function sessaoEws() {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  return { cliente, ws }
}

export async function listarFunis(): Promise<FunilResumo[]> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return []
  const { data, error } = await cliente.from('pipelines')
    .select('id, nome, is_padrao, ordem').eq('workspace_id', ws).order('ordem')
  if (error) throw error
  const funis = (data as Omit<FunilResumo, 'totalNegocios'>[] | null) ?? []
  const { data: negs } = await cliente.from('negocios')
    .select('pipeline_id').eq('workspace_id', ws)
  const cont = new Map<string, number>()
  for (const n of (negs as { pipeline_id: string }[] | null) ?? []) cont.set(n.pipeline_id, (cont.get(n.pipeline_id) ?? 0) + 1)
  return funis.map((f) => ({ ...f, totalNegocios: cont.get(f.id) ?? 0 }))
}

export async function carregarFunil(id: string): Promise<FunilDetalhe | null> {
  const { cliente, ws } = await sessaoEws()
  if (!ws) return null
  const { data: f, error } = await cliente.from('pipelines')
    .select('id, nome, is_padrao').eq('workspace_id', ws).eq('id', id).maybeSingle()
  if (error) throw error
  if (!f) return null
  const funil = f as { id: string; nome: string; is_padrao: boolean }
  const { data: ets } = await cliente.from('etapas')
    .select('id, nome, cor, ordem, sla_dias, probabilidade').eq('workspace_id', ws).eq('pipeline_id', id).order('ordem')
  const etapas = (ets as Omit<EtapaEditor, 'totalNegocios'>[] | null) ?? []
  const { data: negs } = await cliente.from('negocios')
    .select('etapa_id').eq('workspace_id', ws).eq('pipeline_id', id)
  const cont = new Map<string, number>()
  for (const n of (negs as { etapa_id: string }[] | null) ?? []) cont.set(n.etapa_id, (cont.get(n.etapa_id) ?? 0) + 1)
  return { ...funil, etapas: etapas.map((e) => ({ ...e, totalNegocios: cont.get(e.id) ?? 0 })) }
}

export async function criarFunil({ nome }: { nome: string }): Promise<ResId> {
  await exigirEngineLiberado()
  const limpo = nome.trim()
  if (!limpo) return { erro: 'nome_vazio' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: existentes } = await cliente.from('pipelines').select('ordem').eq('workspace_id', ws)
    const ordem = ((existentes as { ordem: number }[] | null) ?? []).reduce((m, l) => Math.max(m, l.ordem), -1) + 1
    const { data, error } = await admin().from('pipelines')
      .insert({ workspace_id: ws, nome: limpo, ordem, is_padrao: false }).select('id').single()
    if (error) throw error
    const funilId = (data as { id: string }).id
    const linhas = ETAPAS_PADRAO.map((e, i) => ({ workspace_id: ws, pipeline_id: funilId, nome: e.nome, ordem: i, cor: e.cor }))
    const { error: e2 } = await admin().from('etapas').insert(linhas)
    if (e2) throw e2
    return { ok: true, id: funilId }
  } catch (err) { console.error('[funis] criar', detalheSeguro(err)); return { erro: 'falha_criar' } }
}

export async function renomearFunil({ id, nome }: { id: string; nome: string }): Promise<Res> {
  await exigirEngineLiberado()
  const limpo = nome.trim()
  if (!limpo) return { erro: 'nome_vazio' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { error } = await admin().from('pipelines').update({ nome: limpo }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[funis] renomear', detalheSeguro(err)); return { erro: 'falha_renomear' } }
}


export async function definirPadrao({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: alvo } = await cliente.from('pipelines').select('id').eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (!alvo) return { erro: 'nao_encontrado' }
    const { error: e1 } = await admin().from('pipelines').update({ is_padrao: false }).eq('workspace_id', ws).eq('is_padrao', true)
    if (e1) throw e1
    const { error: e2 } = await admin().from('pipelines').update({ is_padrao: true }).eq('workspace_id', ws).eq('id', id)
    if (e2) throw e2
    return { ok: true }
  } catch (err) { console.error('[funis] definirPadrao', detalheSeguro(err)); return { erro: 'falha_padrao' } }
}

export async function excluirFunil({ id }: { id: string }): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: f } = await cliente.from('pipelines').select('is_padrao').eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (!f) return { erro: 'nao_encontrado' }
    if ((f as { is_padrao: boolean }).is_padrao) return { erro: 'padrao' }
    const { count } = await cliente.from('negocios').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('pipeline_id', id)
    if ((count ?? 0) > 0) return { erro: 'em_uso' }
    const { error } = await admin().from('pipelines').delete().eq('workspace_id', ws).eq('id', id)  
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[funis] excluir', detalheSeguro(err)); return { erro: 'falha_excluir' } }
}

export async function criarEtapa({ funilId, nome }: { funilId: string; nome: string }): Promise<ResId> {
  await exigirEngineLiberado()
  const limpo = nome.trim()
  if (!limpo) return { erro: 'nome_vazio' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: funil } = await cliente.from('pipelines').select('id').eq('workspace_id', ws).eq('id', funilId).maybeSingle()
    if (!funil) return { erro: 'funil_nao_encontrado' }  
    const { data: ets } = await cliente.from('etapas').select('cor, ordem').eq('workspace_id', ws).eq('pipeline_id', funilId)
    const linhas = (ets as { cor: string | null; ordem: number }[] | null) ?? []
    const ordem = linhas.reduce((m, l) => Math.max(m, l.ordem), -1) + 1
    const cor = proximaCor(linhas.map((l) => l.cor).filter((c): c is string => !!c))
    const { data, error } = await admin().from('etapas')
      .insert({ workspace_id: ws, pipeline_id: funilId, nome: limpo, ordem, cor }).select('id').single()
    if (error) throw error
    return { ok: true, id: (data as { id: string }).id }
  } catch (err) { console.error('[funis] criarEtapa', detalheSeguro(err)); return { erro: 'falha_criar' } }
}

export async function renomearEtapa({ id, nome }: { id: string; nome: string }): Promise<Res> {
  await exigirEngineLiberado()
  const limpo = nome.trim()
  if (!limpo) return { erro: 'nome_vazio' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { error } = await admin().from('etapas').update({ nome: limpo }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[funis] renomearEtapa', detalheSeguro(err)); return { erro: 'falha_renomear' } }
}

export async function recolorirEtapa({ id, cor }: { id: string; cor: string }): Promise<Res> {
  await exigirEngineLiberado()
  if (!corValida(cor)) return { erro: 'cor_invalida' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { error } = await admin().from('etapas').update({ cor }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[funis] recolorir', detalheSeguro(err)); return { erro: 'falha_recolorir' } }
}


export async function reordenarEtapas({ funilId, ordemIds }: { funilId: string; ordemIds: string[] }): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    for (let i = 0; i < ordemIds.length; i++) {
      const { error } = await admin().from('etapas').update({ ordem: i })
        .eq('workspace_id', ws).eq('pipeline_id', funilId).eq('id', ordemIds[i])
      if (error) throw error
    }
    return { ok: true }
  } catch (err) { console.error('[funis] reordenar', detalheSeguro(err)); return { erro: 'falha_reordenar' } }
}



export async function excluirEtapa({ id, destinoId }: { id: string; destinoId?: string }): Promise<Res> {
  await exigirEngineLiberado()
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data: et } = await cliente.from('etapas').select('pipeline_id').eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (!et) return { erro: 'nao_encontrada' }
    const funilId = (et as { pipeline_id: string }).pipeline_id
    const { count: totalEtapas } = await cliente.from('etapas')
      .select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('pipeline_id', funilId)
    if ((totalEtapas ?? 0) <= 1) return { erro: 'ultima_etapa' }
    const { count: usados } = await cliente.from('negocios')
      .select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('etapa_id', id)
    if ((usados ?? 0) > 0) {
      if (!destinoId) return { erro: 'precisa_destino' }        
      if (destinoId === id) return { erro: 'destino_invalido' }
      const { data: dest } = await cliente.from('etapas')
        .select('id').eq('workspace_id', ws).eq('pipeline_id', funilId).eq('id', destinoId).maybeSingle()
      if (!dest) return { erro: 'destino_invalido' }
      const { error: eMove } = await admin().from('negocios').update({ etapa_id: destinoId }).eq('workspace_id', ws).eq('etapa_id', id)
      if (eMove) throw eMove
    }
    const { error } = await admin().from('etapas').delete().eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[funis] excluirEtapa', detalheSeguro(err)); return { erro: 'falha_excluir' } }
}


export async function definirSla({ id, dias }: { id: string; dias: number | null }): Promise<Res> {
  await exigirEngineLiberado()
  if (dias !== null && (!Number.isInteger(dias) || dias <= 0)) return { erro: 'sla_invalido' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { error } = await admin().from('etapas')
      .update({ sla_dias: dias }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[funis] sla', detalheSeguro(err)); return { erro: 'falha_sla' } }
}


export async function definirProbabilidade({ id, valor }: { id: string; valor: number | null }): Promise<Res> {
  await exigirEngineLiberado()
  if (valor !== null && (!Number.isInteger(valor) || valor < 0 || valor > 100))
    return { erro: 'probabilidade_invalida' }
  const { cliente, ws } = await sessaoEws()
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { error } = await admin().from('etapas')
      .update({ probabilidade: valor }).eq('workspace_id', ws).eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (err) { console.error('[funis] probabilidade', detalheSeguro(err)); return { erro: 'falha_probabilidade' } }
}
