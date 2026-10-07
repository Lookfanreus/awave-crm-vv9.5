'use server'

import { criarClienteServidor } from '@/server/supabase-session'
import { admin } from '@/server/supabase'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { assertMesmoPipeline } from '@/server/crm/kanban-ordem'
import { logEtapaMudou } from '@/server/crm/timeline'
import { regrasDaEtapa } from '@/server/crm/campos-etapa'
import { camposFaltantes, avancou } from '@/lib/gate-campos'
import { estadoSla, type EstadoSla } from '@/lib/sla'
import { resolverMembroAtivo } from '@/server/auth/membro-ativo'
import { exigirEngineLiberado } from '@/server/license/exigir'

type Resultado = { ok: true } | { erro: string; campos?: string[] }


export async function moverNegocio(input: {
  negocioId: string
  etapaDestinoId: string
  idsDestino: string[]
  etapaOrigemId?: string   
  idsOrigem?: string[]
}): Promise<Resultado> {
  await exigirEngineLiberado()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return { erro: 'sem_workspace' }

  try {
    const { data: neg, error: e1 } = await cliente
      .from('negocios').select('pipeline_id, etapa_id, campos')
      .eq('id', input.negocioId).eq('workspace_id', ws).maybeSingle()
    if (e1) throw e1
    if (!neg) return { erro: 'negocio_nao_encontrado' }

    const { data: etapa, error: e2 } = await cliente
      .from('etapas').select('pipeline_id, nome, ordem')
      .eq('id', input.etapaDestinoId).eq('workspace_id', ws).maybeSingle()
    if (e2) throw e2
    if (!etapa) return { erro: 'etapa_nao_encontrada' }

    assertMesmoPipeline((neg as { pipeline_id: string }).pipeline_id, (etapa as { pipeline_id: string; nome: string }).pipeline_id)

    
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

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    let ordemDoMovido = -1
    for (let i = 0; i < input.idsDestino.length; i++) {
      const id = input.idsDestino[i]
      if (id === input.negocioId) { ordemDoMovido = i; continue }
      
      const { error } = await admin().from('negocios')
        .update({ ordem: i })
        .eq('id', id).eq('workspace_id', ws).eq('etapa_id', input.etapaDestinoId)
      if (error) throw error
    }
    if (input.idsOrigem) {
      for (let i = 0; i < input.idsOrigem.length; i++) {
        const alvo = admin().from('negocios').update({ ordem: i })
          .eq('id', input.idsOrigem[i]).eq('workspace_id', ws)
        const { error } = await (input.etapaOrigemId ? alvo.eq('etapa_id', input.etapaOrigemId) : alvo)
        if (error) throw error
      }
    }
    
    
    const { error: eTransicao } = await admin().from('negocios')
      .update({ ordem: Math.max(ordemDoMovido, 0), etapa_id: input.etapaDestinoId })
      .eq('id', input.negocioId).eq('workspace_id', ws)
    if (eTransicao) throw eTransicao

    
    
    
    
    try {
      await logEtapaMudou(admin(), ws, input.negocioId, (etapa as { pipeline_id: string; nome: string }).nome)
    } catch {  }
    return { ok: true }
  } catch {
    return { erro: 'falha_mover' }
  }
}


export async function criarRapido(input: {
  etapaId: string
  titulo: string
  valor?: number | null
}): Promise<{ ok: true; cartao: {
  id: string; titulo: string; valor: string | null; etapaId: string; ordem: number
  travado: boolean; diasNaEtapa: number; sla: EstadoSla; responsavelId: string | null
} } | { erro: string }> {
  await exigirEngineLiberado()
  const titulo = input.titulo.trim()
  if (!titulo) return { erro: 'titulo_obrigatorio' }

  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return { erro: 'sem_workspace' }

  try {
    const { data: etapa, error: e1 } = await cliente
      .from('etapas').select('pipeline_id, sla_dias')
      .eq('id', input.etapaId).eq('workspace_id', ws).maybeSingle()
    if (e1) throw e1
    if (!etapa) return { erro: 'etapa_nao_encontrada' }

    const { data: ult, error: e2 } = await cliente
      .from('negocios').select('ordem')
      .eq('workspace_id', ws).eq('etapa_id', input.etapaId)
      .order('ordem', { ascending: false }).limit(1).maybeSingle()
    if (e2) throw e2
    const ordem = ((ult as { ordem: number } | null)?.ordem ?? -1) + 1

    
    
    
    const responsavelId = await resolverMembroAtivo({ cliente, ws })

    const { data, error } = await admin().from('negocios')
      .insert({
        workspace_id: ws,
        pipeline_id: (etapa as { pipeline_id: string }).pipeline_id,
        etapa_id: input.etapaId,
        titulo,
        valor: input.valor ?? null,
        status: 'aberto',
        ordem,
        responsavel_id: responsavelId,
      })
      .select('id, titulo, valor, etapa_id, ordem, responsavel_id').single()
    if (error) throw error
    const n = data as { id: string; titulo: string; valor: string | null; etapa_id: string; ordem: number; responsavel_id: string | null }
    
    
    const { obrigatorios } = await regrasDaEtapa(input.etapaId)
    
    
    const agora = new Date()
    return {
      ok: true,
      cartao: {
        id: n.id, titulo: n.titulo, valor: n.valor, etapaId: n.etapa_id, ordem: n.ordem,
        
        
        responsavelId: n.responsavel_id,
        travado: obrigatorios.length > 0,
        diasNaEtapa: 0,
        sla: estadoSla(agora.toISOString(), (etapa as { sla_dias: number | null }).sla_dias ?? null, agora),
      },
    }
  } catch {
    return { erro: 'falha_criar' }
  }
}


export async function ganharNegocio(negocioId: string): Promise<Resultado> {
  await exigirEngineLiberado()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return { erro: 'sem_workspace' }
  const { data: neg } = await cliente.from('negocios')
    .select('etapa_id, campos').eq('id', negocioId).eq('workspace_id', ws).maybeSingle()
  if (!neg) return { erro: 'negocio_nao_encontrado' }
  const n = neg as { etapa_id: string; campos?: Record<string, unknown> }
  const { obrigatorios, rotulos } = await regrasDaEtapa(n.etapa_id)
  const faltando = camposFaltantes(obrigatorios, n.campos ?? {})
  if (faltando.length) return { erro: 'campos_obrigatorios', campos: faltando.map((s) => rotulos[s] ?? s) }
  return fecharNegocio(negocioId, { status: 'ganho' })
}
export async function perderNegocio(negocioId: string, motivo: string): Promise<Resultado> {
  await exigirEngineLiberado()
  const m = motivo.trim()
  if (!m) return { erro: 'motivo_obrigatorio' }
  return fecharNegocio(negocioId, { status: 'perdido', motivo_perda: m })
}

async function fecharNegocio(negocioId: string, extra: Record<string, unknown>): Promise<Resultado> {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return { erro: 'sem_workspace' }
  try {
    const { data, error } = await admin().from('negocios')
      .update({ ...extra, fechado_em: new Date().toISOString() })
      .eq('id', negocioId).eq('workspace_id', ws)
      .select('id').maybeSingle()
    if (error) throw error
    if (!data) return { erro: 'negocio_nao_encontrado' }
    return { ok: true }
  } catch {
    return { erro: 'falha_fechar' }
  }
}
