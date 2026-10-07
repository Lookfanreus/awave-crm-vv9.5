import 'server-only'
import { criarOrcamento, type Orcamento } from '@/lib/orcamento-tick'
import { admin } from '@/server/supabase'
import { backoff } from '@/server/webhook/nucleo'
import { ehFalhaDeterministica } from '@/lib/automacao-erros'
import { executarAcao, type CtxAcao, type ResultadoAcao } from '@/server/automacao/acoes'
import type { ItemAcao } from '@/lib/automacao-forma'
import type { Execucao } from '@/server/crm/automacoes'
import { detalheSeguro } from '@/lib/sanitizar-erro'



const LIMITE_POR_TICK = 20
const MAX_TENTATIVAS = 8 


export const CHAVE_GERACAO = '_geracao_automacao'


export const MARGEM_CARIMBO_MS = 2_000


export const MAX_GERACOES_CADEIA = 6

type Cli = ReturnType<typeof admin>


type LinhaReservada = Execucao & { workspace_id: string }


type AutomacaoAtiva = { id: string; ativo: boolean; acoes: ItemAcao[] }


type FatoParaCarimbar = { id: string; dados: Record<string, unknown> | null }


export async function executarPendentes(
  agora: Date = new Date(),
  relogio: () => Date = () => new Date(),
  orcamento: Orcamento = criarOrcamento(Date.now()),
): Promise<{ ok: number; erros: number; desistidos: number; cancelados: number; pulados: number }> {
  const cli = admin()

  
  
  const { data, error } = await cli.rpc('reservar_execucoes', { p_limite: LIMITE_POR_TICK })
  if (error) throw error
  const linhas = (data ?? []) as LinhaReservada[]

  let ok = 0, erros = 0, desistidos = 0, cancelados = 0, pulados = 0
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    
    
    
    
    
    if (!orcamento.cabe('automacao')) {
      await soltarReserva(cli, linhas.slice(i))
      pulados += linhas.length - i
      break
    }
    try {
      
      
      const resultado = await executarUma(cli, linha, agora, relogio)
      if (resultado === 'ok') ok++
      else if (resultado === 'falha') erros++
      else if (resultado === 'desistido') desistidos++
      else cancelados++
    } catch (err) {
      
      
      
      console.error('[automacao] executor', linha.id, detalheSeguro(err))
      erros++
    }
  }
  return { ok, erros, desistidos, cancelados, pulados }
}


async function soltarReserva(cli: Cli, linhas: LinhaReservada[]) {
  const agoraIso = new Date().toISOString()
  for (const linha of linhas) {
    const { error } = await cli
      .from('execucoes_automacao')
      .update({ proxima_tentativa: agoraIso })
      .eq('workspace_id', linha.workspace_id)
      .eq('id', linha.id)
    if (error) console.warn('[automacao] reserva nao devolvida a fila')
  }
}


async function executarUma(
  cli: Cli, linha: LinhaReservada, agora: Date, relogio: () => Date,
): Promise<'ok' | 'falha' | 'desistido' | 'cancelado'> {
  const ws = linha.workspace_id 

  
  
  const { data: automacaoData, error: erroAutomacao } = await cli
    .from('automacoes')
    .select('id, ativo, acoes')
    .eq('workspace_id', ws)
    .eq('id', linha.automacao_id)
    .maybeSingle()
  if (erroAutomacao) throw erroAutomacao
  const automacao = automacaoData as AutomacaoAtiva | null
  if (!automacao || !automacao.ativo) {
    await finalizarCancelado(cli, linha, ws, agora, 'automacao_inativa')
    return 'cancelado'
  }
  const acoes = Array.isArray(automacao.acoes) ? automacao.acoes : []

  
  
  
  
  
  
  let geracaoLida: number | null = null
  const geracaoDaCadeia = async (): Promise<number> => {
    if (geracaoLida === null) geracaoLida = await geracaoDoFato(cli, ws, linha.fato_id)
    return geracaoLida
  }

  
  
  
  
  
  
  
  
  
  if ((await geracaoDaCadeia()) >= MAX_GERACOES_CADEIA) {
    await finalizarCancelado(cli, linha, ws, agora, 'cadeia_profunda')
    return 'cancelado'
  }

  
  if (linha.negocio_id) {
    const { data: negocioData, error: erroNegocio } = await cli
      .from('negocios')
      .select('id')
      .eq('workspace_id', ws)
      .eq('id', linha.negocio_id)
      .maybeSingle()
    if (erroNegocio) throw erroNegocio
    if (!negocioData) {
      await finalizarCancelado(cli, linha, ws, agora, 'alvo_removido')
      return 'cancelado'
    }
  }

  
  const ctx: CtxAcao = { workspaceId: ws, negocioId: linha.negocio_id, automacaoId: automacao.id, agora }
  
  
  
  
  
  
  
  
  
  
  
  
  const marcoT = new Date(relogio().getTime() - MARGEM_CARIMBO_MS).toISOString()
  const resultados: ResultadoAcao[] = []
  let falha: { erro: string } | null = null
  
  
  for (const acaoItem of acoes) {
    const r = await executarAcao(cli, ctx, acaoItem)
    resultados.push(r)
    if (!r.ok) { falha = { erro: r.erro }; break }
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const negociosParaCarimbar = new Set<string>()
  if (linha.negocio_id) negociosParaCarimbar.add(linha.negocio_id)
  for (const r of resultados) {
    if (r.ok && Array.isArray(r.negociosCriados)) {
      for (const id of r.negociosCriados) negociosParaCarimbar.add(id)
    }
  }
  if (negociosParaCarimbar.size > 0) {
    const geracaoFilha = (await geracaoDaCadeia()) + 1
    for (const negocioId of negociosParaCarimbar) {
      const { data: aCarimbar, error: erroLeitura } = await cli
        .from('fatos_automacao')
        .select('id, dados')
        .eq('workspace_id', ws).eq('negocio_id', negocioId)
        .is('origem_automacao_id', null).is('processado_em', null)
        .gte('criado_em', marcoT)
      if (erroLeitura) throw erroLeitura
      for (const fato of ((aCarimbar ?? []) as FatoParaCarimbar[])) {
        const dados = fato.dados && typeof fato.dados === 'object' ? fato.dados : {}
        const { error: erroCarimbo } = await cli
          .from('fatos_automacao')
          .update({ origem_automacao_id: automacao.id, dados: { ...dados, [CHAVE_GERACAO]: geracaoFilha } })
          .eq('workspace_id', ws).eq('id', fato.id)
          
          
          .is('origem_automacao_id', null)
        if (erroCarimbo) throw erroCarimbo
      }
    }
  }

  
  if (!falha) {
    const { error: erroFinal } = await cli
      .from('execucoes_automacao')
      .update({ estado: 'ok', executado_em: agora.toISOString(), resultado: { acoes: resultados } })
      .eq('id', linha.id).eq('workspace_id', ws)
    if (erroFinal) throw erroFinal
    return 'ok'
  }
  return await falhar(cli, linha, ws, agora, falha.erro, { acoes: resultados })
}


async function geracaoDoFato(cli: Cli, workspaceId: string, fatoId: string | null): Promise<number> {
  if (!fatoId) return 0
  const { data, error } = await cli
    .from('fatos_automacao')
    .select('origem_automacao_id, dados')
    .eq('workspace_id', workspaceId)
    .eq('id', fatoId)
    .maybeSingle()
  if (error) throw error
  const fato = data as { origem_automacao_id: string | null; dados: Record<string, unknown> | null } | null
  if (!fato?.origem_automacao_id) return 0
  const bruto = fato.dados?.[CHAVE_GERACAO]
  const geracao = typeof bruto === 'number' && Number.isFinite(bruto) ? Math.floor(bruto) : 0
  return geracao >= 1 ? geracao : 1
}


async function finalizarCancelado(
  cli: Cli, linha: LinhaReservada, ws: string, agora: Date, motivo: string,
): Promise<void> {
  const { error } = await cli
    .from('execucoes_automacao')
    .update({ estado: 'cancelado', executado_em: agora.toISOString(), resultado: { motivo } })
    .eq('id', linha.id).eq('workspace_id', ws)
  if (error) throw error
}


async function falhar(
  cli: Cli, linha: LinhaReservada, ws: string, agora: Date, motivo: string, resultado: unknown,
): Promise<'falha' | 'desistido'> {
  const tentativas = linha.tentativas + 1
  const desistiu = tentativas >= MAX_TENTATIVAS || ehFalhaDeterministica(motivo)
  const patch: Record<string, unknown> = {
    tentativas, ultimo_erro: motivo, resultado,
    proxima_tentativa: new Date(agora.getTime() + backoff(tentativas)).toISOString(),
  }
  
  
  if (desistiu) patch.estado = 'desistido'
  const { error } = await cli.from('execucoes_automacao').update(patch).eq('id', linha.id).eq('workspace_id', ws)
  if (error) throw error
  return desistiu ? 'desistido' : 'falha'
}
