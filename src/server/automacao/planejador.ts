import 'server-only'
import { admin } from '@/server/supabase'
import { avaliar, type ContextoNegocio, type Condicao } from '@/lib/automacao-condicao'
import { venceuParado, marcaParado, venceuAtividade, marcaVencimento, chaveDaMarca } from '@/lib/automacao-tempo'
import { detalheSeguro } from '@/lib/sanitizar-erro'
import { LOTE_DE_IDS } from '@/lib/lote-de-ids'



const LIMITE_FATOS = 200
















const DISJUNTOR_JANELA_MIN = 5
const DISJUNTOR_MAX = 20

type Cli = ReturnType<typeof admin>


type Varredura = { execucoes: number; degradou: boolean }
const SEM_VARREDURA: Varredura = { execucoes: 0, degradou: false }

type FatoPendente = {
  id: string
  workspace_id: string
  tipo: string
  negocio_id: string | null
  dados: Record<string, unknown>
  origem_automacao_id: string | null
  criado_em: string
}

type AutomacaoAtiva = {
  id: string
  workspace_id: string
  gatilho_config: Record<string, unknown>
  condicoes: unknown
  ordem: number
}


export async function planejar(agora: Date = new Date()): Promise<{ fatos: number; execucoes: number; ignorados: number; erros: number }> {
  const cli = admin()

  const { data, error } = await cli
    .from('fatos_automacao')
    .select('id, workspace_id, tipo, negocio_id, dados, origem_automacao_id, criado_em')
    .is('processado_em', null)
    .order('criado_em')
    .limit(LIMITE_FATOS)
  if (error) throw error
  const fatos = (data as FatoPendente[] | null) ?? []

  let execucoes = 0
  let ignorados = 0
  let erros = 0

  for (const fato of fatos) {
    try {
      const candidatas = await candidatasDoFato(cli, fato)

      
      const regras = candidatas.filter((r) => r.id !== fato.origem_automacao_id)
      ignorados += candidatas.length - regras.length

      if (regras.length === 0) {
        await marcarProcessado(cli, fato)
        continue
      }

      
      
      
      if (fato.negocio_id && (await disjuntorAberto(cli, fato.workspace_id, fato.negocio_id))) {
        await registrarCancelado(cli, fato, regras[0])
        ignorados++
        await marcarProcessado(cli, fato)
        continue
      }

      
      let ctx: ContextoNegocio | null | undefined
      for (const r of regras) {
        if (!casaConfig(r, fato)) continue
        if (ctx === undefined) ctx = await montarContexto(cli, fato.workspace_id, fato.negocio_id)
        if (!ctx) continue 

        if (!avaliar(r.condicoes as Condicao | null, ctx)) {
          await cli.from('execucoes_automacao').insert({
            workspace_id: r.workspace_id, 
            automacao_id: r.id,
            negocio_id: fato.negocio_id,
            fato_id: fato.id,
            estado: 'ok',
            executado_em: new Date().toISOString(),
            resultado: { condicao: false }, 
          })
          execucoes++
          continue
        }

        await cli.from('execucoes_automacao').insert({
          workspace_id: r.workspace_id, 
          automacao_id: r.id,
          negocio_id: fato.negocio_id,
          fato_id: fato.id,
          estado: 'pendente',
        })
        execucoes++
      }

      await marcarProcessado(cli, fato)
    } catch (err) {
      
      
      
      
      
      
      console.error('[automacao] planejar fato', fato.id, detalheSeguro(err))
      erros++
    }
  }

  
  
  
  
  try {
    const varredura = await varrerGatilhosTempo(cli, agora)
    execucoes += varredura.execucoes
    erros += varredura.erros
  } catch (err) {
    console.error('[automacao] planejar varredura', detalheSeguro(err))
    erros++
  }

  return { fatos: fatos.length, execucoes, ignorados, erros }
}


async function candidatasDoFato(cli: Cli, fato: FatoPendente): Promise<AutomacaoAtiva[]> {
  const { data, error } = await cli
    .from('automacoes')
    .select('id, workspace_id, gatilho_config, condicoes, ordem')
    .eq('workspace_id', fato.workspace_id)
    .eq('gatilho', fato.tipo)
    .eq('ativo', true)
    .order('ordem')
  if (error) throw error
  return (data as AutomacaoAtiva[] | null) ?? []
}


function casaConfig(regra: AutomacaoAtiva, fato: FatoPendente): boolean {
  const cfg = regra.gatilho_config ?? {}
  const dados = fato.dados ?? {}
  if (typeof cfg.para_etapa_id === 'string' && cfg.para_etapa_id !== dados.para_etapa_id) return false
  if (typeof cfg.de_etapa_id === 'string' && cfg.de_etapa_id !== dados.de_etapa_id) return false
  if (fato.tipo === 'campo_alterado') {
    if (typeof cfg.campo !== 'string' || !cfg.campo) return false
    const antes = (dados.campos_antes as Record<string, unknown> | null) ?? {}
    const depois = (dados.campos_depois as Record<string, unknown> | null) ?? {}
    if (!campoMudou(antes[cfg.campo], depois[cfg.campo])) return false
  }
  return true
}


function campoMudou(antes: unknown, depois: unknown): boolean {
  return JSON.stringify(antes ?? null) !== JSON.stringify(depois ?? null)
}


async function montarContexto(cli: Cli, workspaceId: string, negocioId: string | null): Promise<ContextoNegocio | null> {
  if (!negocioId) return null
  const { data, error } = await cli
    .from('negocios')
    .select('titulo, valor, status, etapa_id, responsavel_id, campos')
    .eq('workspace_id', workspaceId)
    .eq('id', negocioId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const n = data as {
    titulo: string; valor: string | null; status: string
    etapa_id: string; responsavel_id: string | null; campos: Record<string, unknown> | null
  }
  return {
    titulo: n.titulo, valor: n.valor, status: n.status,
    etapa_id: n.etapa_id, responsavel_id: n.responsavel_id, campos: n.campos ?? {},
  }
}


async function disjuntorAberto(cli: Cli, workspaceId: string, negocioId: string): Promise<boolean> {
  const desde = new Date(Date.now() - DISJUNTOR_JANELA_MIN * 60_000).toISOString()
  const { count, error } = await cli
    .from('execucoes_automacao')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('negocio_id', negocioId)
    .gte('criado_em', desde)
  if (error) throw error
  return (count ?? 0) >= DISJUNTOR_MAX
}


async function registrarCancelado(cli: Cli, fato: FatoPendente, regraRef: AutomacaoAtiva): Promise<void> {
  const { error } = await cli.from('execucoes_automacao').insert({
    workspace_id: regraRef.workspace_id, 
    automacao_id: regraRef.id,
    negocio_id: fato.negocio_id,
    fato_id: fato.id,
    estado: 'cancelado',
    executado_em: new Date().toISOString(),
    resultado: { motivo: 'disjuntor_aberto' },
  })
  if (error) throw error
}


async function marcarProcessado(cli: Cli, fato: FatoPendente): Promise<void> {
  const { error } = await cli
    .from('fatos_automacao')
    .update({ processado_em: new Date().toISOString() })
    .eq('id', fato.id)
    .eq('workspace_id', fato.workspace_id)
  if (error) throw error
}







type AutomacaoTempoAtiva = {
  id: string
  workspace_id: string
  gatilho: string
  gatilho_config: Record<string, unknown>
  condicoes: unknown
}


async function varrerGatilhosTempo(cli: Cli, agora: Date): Promise<{ execucoes: number; erros: number }> {
  const { data, error } = await cli
    .from('automacoes')
    .select('id, workspace_id, gatilho, gatilho_config, condicoes')
    .in('gatilho', ['negocio_parado', 'atividade_vencida'])
    .eq('ativo', true)
  if (error) throw error
  const regras = (data as AutomacaoTempoAtiva[] | null) ?? []

  let execucoes = 0
  let erros = 0
  for (const regra of regras) {
    try {
      const r = regra.gatilho === 'negocio_parado'
        ? await varrerNegocioParado(cli, regra, agora)
        : await varrerAtividadeVencida(cli, regra, agora)
      execucoes += r.execucoes
      
      
      
      
      if (r.degradou) erros++
    } catch (err) {
      console.error('[automacao] varredura', regra.gatilho, regra.id, detalheSeguro(err))
      erros++
    }
  }
  return { execucoes, erros }
}

type NegocioParado = {
  id: string; titulo: string; valor: string | null; status: string
  etapa_id: string; etapa_desde: string; responsavel_id: string | null
  campos: Record<string, unknown> | null
}


async function varrerNegocioParado(cli: Cli, regra: AutomacaoTempoAtiva, agora: Date): Promise<Varredura> {
  const cfg = regra.gatilho_config ?? {}
  const dias = typeof cfg.dias === 'number' ? cfg.dias : null
  if (dias === null || dias <= 0) return SEM_VARREDURA

  let query = cli
    .from('negocios')
    .select('id, titulo, valor, status, etapa_id, etapa_desde, responsavel_id, campos')
    .eq('workspace_id', regra.workspace_id)
    .eq('status', 'aberto')
  if (typeof cfg.etapa_id === 'string') query = query.eq('etapa_id', cfg.etapa_id)
  const { data, error } = await query
  if (error) throw error
  const negocios = (data as NegocioParado[] | null) ?? []

  
  
  
  
  
  
  const candidatos = negocios
    .filter((n) => venceuParado(n.etapa_desde, dias, agora))
    .map((n) => ({ n, marca: marcaParado(n.etapa_desde) }))
  if (!candidatos.length) return SEM_VARREDURA
  const jaMarcados = await marcasJaGravadas(cli, regra.workspace_id, regra.id, candidatos.map((c) => c.n.id))

  let execucoes = 0
  for (const { n, marca } of candidatos) {
    if (jaMarcados?.has(chaveDaMarca(n.id, marca))) continue 
    const marcado = await tentarMarcar(cli, regra.workspace_id, regra.id, n.id, marca)
    if (!marcado) continue 

    const ctx: ContextoNegocio = {
      titulo: n.titulo, valor: n.valor, status: n.status,
      etapa_id: n.etapa_id, responsavel_id: n.responsavel_id, campos: n.campos ?? {},
    }
    await registrarExecucaoVarredura(cli, regra, n.id, ctx)
    execucoes++
  }
  return { execucoes, degradou: jaMarcados === null }
}

type AtividadeVencida = {
  id: string; negocio_id: string | null; vencimento: string | null; concluida_em: string | null
}


async function varrerAtividadeVencida(cli: Cli, regra: AutomacaoTempoAtiva, agora: Date): Promise<Varredura> {
  const cfg = regra.gatilho_config ?? {}

  let tipoId: string | undefined
  if (typeof cfg.tipo_slug === 'string') {
    const { data, error } = await cli
      .from('tipos_atividade')
      .select('id')
      .eq('workspace_id', regra.workspace_id)
      .eq('slug', cfg.tipo_slug)
      .maybeSingle()
    if (error) throw error
    const tipo = data as { id: string } | null
    if (!tipo) return SEM_VARREDURA 
    tipoId = tipo.id
  }

  let query = cli
    .from('atividades')
    .select('id, negocio_id, vencimento, concluida_em')
    .eq('workspace_id', regra.workspace_id)
    .is('concluida_em', null)
  if (tipoId) query = query.eq('tipo_id', tipoId)
  const { data, error } = await query
  if (error) throw error
  const atividades = (data as AtividadeVencida[] | null) ?? []

  
  
  const candidatos = atividades
    .filter((a) => a.negocio_id && venceuAtividade(a.vencimento, a.concluida_em, agora))
    .map((a) => ({ a, negocioId: a.negocio_id as string, marca: marcaVencimento(a.id) }))
  if (!candidatos.length) return SEM_VARREDURA
  const jaMarcados = await marcasJaGravadas(cli, regra.workspace_id, regra.id, candidatos.map((c) => c.negocioId))

  let execucoes = 0
  for (const { a, negocioId, marca } of candidatos) {
    if (jaMarcados?.has(chaveDaMarca(negocioId, marca))) continue 
    const marcado = await tentarMarcar(cli, regra.workspace_id, regra.id, negocioId, marca)
    if (!marcado) continue 

    const ctx = await montarContexto(cli, regra.workspace_id, negocioId)
    if (!ctx) continue 

    await registrarExecucaoVarredura(cli, regra, negocioId, ctx)
    execucoes++
  }
  return { execucoes, degradou: jaMarcados === null }
}






const PAGINA_DE_MARCAS = 1000


async function marcasJaGravadas(
  cli: Cli, workspaceId: string, automacaoId: string, negocioIds: string[],
): Promise<Set<string> | null> {
  const chaves = new Set<string>()
  
  
  
  const ids = [...new Set(negocioIds)]
  try {
    for (let i = 0; i < ids.length; i += LOTE_DE_IDS) {
      const lote = ids.slice(i, i + LOTE_DE_IDS)
      let de = 0
      for (;;) {
        const { data, error } = await cli
          .from('automacao_marcas')
          .select('negocio_id, marca')
          .eq('workspace_id', workspaceId)
          .eq('automacao_id', automacaoId)
          .in('negocio_id', lote)
          
          
          
          
          
          .order('negocio_id')
          .order('marca')
          .range(de, de + PAGINA_DE_MARCAS - 1)
        if (error) throw error
        const linhas = (data as { negocio_id: string; marca: string }[] | null) ?? []
        for (const l of linhas) chaves.add(chaveDaMarca(l.negocio_id, l.marca))
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        if (linhas.length < PAGINA_DE_MARCAS) break
        de += linhas.length
      }
    }
  } catch (err) {
    console.warn('[automacao] leitura de marcas falhou, seguindo sem o filtro:', detalheSeguro(err))
    return null
  }
  return chaves
}


async function tentarMarcar(cli: Cli, workspaceId: string, automacaoId: string, negocioId: string, marca: string): Promise<boolean> {
  const { error } = await cli.from('automacao_marcas').insert({
    workspace_id: workspaceId, automacao_id: automacaoId, negocio_id: negocioId, marca,
  })
  if (!error) return true
  if ((error as { code?: string })?.code === '23505') return false
  throw error
}


async function registrarExecucaoVarredura(cli: Cli, regra: AutomacaoTempoAtiva, negocioId: string, ctx: ContextoNegocio): Promise<void> {
  if (!avaliar(regra.condicoes as Condicao | null, ctx)) {
    const { error } = await cli.from('execucoes_automacao').insert({
      workspace_id: regra.workspace_id, 
      automacao_id: regra.id,
      negocio_id: negocioId,
      fato_id: null,
      estado: 'ok',
      executado_em: new Date().toISOString(),
      resultado: { condicao: false }, 
    })
    if (error) throw error
    return
  }
  const { error } = await cli.from('execucoes_automacao').insert({
    workspace_id: regra.workspace_id, 
    automacao_id: regra.id,
    negocio_id: negocioId,
    fato_id: null,
    estado: 'pendente',
  })
  if (error) throw error
}
