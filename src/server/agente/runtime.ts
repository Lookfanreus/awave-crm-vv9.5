




























import 'server-only'
import {
  concluirSeIntacto,
  esgotou,
  marcarRodadaPaga,
  matarJob,
  requeueJob,
  reivindicarJobs,
  type JobDaFila,
} from '@/server/agente/fila'
import { acumuladoVazio, estourou, lerRodadas, registrarRodada } from '@/server/agente/tetos'
import { marcarNaInbox, type MotivoDaMarca } from '@/server/agente/marca'
import { criarOrcamento, type Orcamento } from '@/lib/orcamento-tick'
import {
  JOBS_POR_TICK,
  PASSOS_MAX,
  SILENCIO_MS,
  SILENCIO_TOOL_MS,
  TURNO_MAX_MS,
} from '@/server/agente/orcamento'
import {
  carregarContexto,
  decidirRodada,
  falasDoLote,
  type MotivoDeNaoRodar,
} from '@/server/agente/contexto'
import { buscarNaBase, TIPOS_DO_BLOCO_AUTOMATICO } from '@/server/agente/busca-base'















import { cortadoPeloPrazo, rodarUmaRodada, type RodadaResultado } from '@/server/agente/rodada'
import { registrarCusto } from '@/server/agente/custo'
import { contarAvisosEntregues, textoParaOCanal, TETO_BOLHAS } from '@/server/agente/saida'
import { enviarMensagem } from '@/server/canais/envio'
import { motivoDeBloqueioAtual } from '@/server/license/bloqueio'
import { montarPrompt } from '@/lib/canais/prompt-agente'
import { lerHorarioDeAtendimento } from '@/server/agente/horario'
import { avaliarAtendimento } from '@/lib/agente/horario-atendimento'
import { cortarBloco, montarHistorico } from '@/lib/canais/historico-agente'
import { montarBlocoConhecimento } from '@/lib/canais/bloco-conhecimento'
import { aplicarDisclosure, linhaDoDisclosure, precisaDisclosure } from '@/lib/canais/disclosure'
import { decidirPreSend } from '@/lib/canais/presend'
import { CONFIRMACAO_HUMANO } from '@/lib/canais/humano'
import { classificarErroMeta } from '@/lib/canais/erroMeta'
import { proximaTentativa } from '@/lib/canais/politicaRetry'
import { redigirValores } from '@/lib/canais/redigir'

export type ResumoDoBraco = {
  reivindicados: number
  respondidos: number
  pulados: number
  motivo?: 'licenca_hard' | 'sem_orcamento'
}


const MARCA_DA_RECUSA: Record<MotivoDeNaoRodar, MotivoDaMarca | null> = {
  sem_conversa: null,
  sem_canal: null,
  workspace_divergente: null,
  agente_desligado: null,
  humano_com_a_conversa: null,
  job_velho: 'falhou',
  fora_da_janela: null,
  teto_conversa: 'teto_conversa',
  
  
  teto_workspace: 'teto_servidor',
  teto_deploy: 'teto_servidor',
  pediu_humano: 'pedido_de_humano',
  ninguem_perguntou: null,
}


const RECUSAS_QUE_MATAM = new Set<MotivoDeNaoRodar>(['workspace_divergente', 'job_velho'])


async function marcarSemDerrubar(
  ws: string,
  conversaId: string,
  motivo: MotivoDaMarca,
  agoraIso: string,
): Promise<void> {
  try {
    await marcarNaInbox(ws, conversaId, motivo, agoraIso)
  } catch (err) {
    console.warn('[agente/runtime] marca nao registrada:', redigirValores(err, []))
  }
}


async function concluirOuDevolver(job: JobDaFila): Promise<void> {
  if (!(await concluirSeIntacto(job))) await requeueJob(job, {})
}


export async function drenarAgente(
  orcamento: Orcamento = criarOrcamento(Date.now()),
): Promise<ResumoDoBraco> {
  const resumo: ResumoDoBraco = { reivindicados: 0, respondidos: 0, pulados: 0 }

  
  
  
  
  
  
  
  
  
  
  try {
    if ((await motivoDeBloqueioAtual()) === 'hard') {
      return { ...resumo, motivo: 'licenca_hard' }
    }
  } catch {
    
    
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (!orcamento.cabe('agente')) return { ...resumo, motivo: 'sem_orcamento' }

  const jobs = await reivindicarJobs(JOBS_POR_TICK)
  resumo.reivindicados = jobs.length
  const acumulado = acumuladoVazio()

  for (const job of jobs) {
    
    
    try {
      const desfecho = await atenderUmJob(job, acumulado)
      if (desfecho === 'respondeu') resumo.respondidos++
      else resumo.pulados++
    } catch (err) {
      resumo.pulados++
      
      
      
      const { lerChaveOpenAI } = await import('@/server/agente/agente')
      const chave = await lerChaveOpenAI().catch(() => null)
      await requeueComBackoff(job, err, chave)
    }
  }

  return resumo
}


export async function atenderUmJob(
  job: JobDaFila,
  acumulado: ReturnType<typeof acumuladoVazio>,
  assistenteEscolhido?: string | null,
): Promise<'respondeu' | 'pulou'> {
  const agoraMs = Date.now()
  const agoraIso = new Date(agoraMs).toISOString()
  const ws = job.workspace_id

  const ctx = await carregarContexto(job, assistenteEscolhido)
  const lidas = await lerRodadas(ws, job.conversa_id, agoraMs)

  const decisao = decidirRodada({
    jobWorkspaceId: ws,
    naoAntesMs: Date.parse(job.nao_antes),
    agoraMs,
    conversa: ctx.conversa,
    canal: ctx.canal,
    
    
    
    
    
    
    
    
    
    estouro: estourou(lidas, acumulado, ws, job.conversa_id, job.rodadas_pagas),
    mensagens: ctx.mensagens,
  })

  if (!decisao.rodar) {
    const marca = MARCA_DA_RECUSA[decisao.motivo]

    
    
    
    if (decisao.motivo === 'pediu_humano') {
      await passarParaHumano(ws, job.conversa_id, agoraIso)
    }

    if (RECUSAS_QUE_MATAM.has(decisao.motivo)) {
      
      
      
      
      
      
      
      
      if ((await matarJob(job, decisao.motivo)) && marca) {
        await marcarSemDerrubar(ws, job.conversa_id, marca, agoraIso)
      }
    } else {
      
      
      
      
      
      
      if (marca) await marcarSemDerrubar(ws, job.conversa_id, marca, agoraIso)
      
      
      
      
      await concluirOuDevolver(job)
    }
    return 'pulou'
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const { lerChaveOpenAI, lerModelo, montarAgente } = await import('@/server/agente/agente')
  const chave = await lerChaveOpenAI()
  if (!chave) {
    await marcarSemDerrubar(ws, job.conversa_id, 'sem_chave', agoraIso)
    
    
    await concluirOuDevolver(job)
    return 'pulou'
  }
  const modelo = await lerModelo()

  
  
  
  
  
  
  
  
  
  
  const atendimento = avaliarAtendimento(await lerHorarioDeAtendimento(ws), agoraMs)

  
  
  
  
  
  
  
  
  
  
  
  if (!(await marcarRodadaPaga(job))) return 'pulou'

  registrarRodada(acumulado, ws, job.conversa_id)

  const agente = montarAgente({
    apiKey: chave,
    modelo,
    
    
    
    
    instrucoes: montarPrompt({ ...ctx.persona, atendimento }),
    ctx: {
      workspaceId: ws,
      conversaId: job.conversa_id,
      contatoId: ctx.conversa?.contato_id ?? null,
      
      
      
      assistenteId: ctx.assistenteId,
    },
  })

  
  
  
  
  
  
  
  
  
  
  const achados = await buscarNaBase(ws, falasDoLote(ctx.mensagens).join(' '), {
    conversaId: job.conversa_id,
    tipos: TIPOS_DO_BLOCO_AUTOMATICO,
    assistenteId: ctx.assistenteId,
  })
  
  
  
  if (achados === 'indisponivel') {
    await marcarSemDerrubar(ws, job.conversa_id, 'base_indisponivel', agoraIso)
  }

  
  
  
  
  
  
  
  
  
  const falas = cortarBloco(
    [
      ...montarHistorico(ctx.mensagens),
      {
        role: 'user' as const,
        content: montarBlocoConhecimento(achados === 'indisponivel' ? 'indisponivel' : { achados }),
      },
    ],
    (f) => f.content.length,
  )

  const snapshotInAt = ctx.conversa?.ultima_msg_in_at ?? null
  const rodada = await rodarUmaRodada(agente, falas, {
    passosMax: PASSOS_MAX,
    silencioMs: SILENCIO_MS,
    silencioToolMs: SILENCIO_TOOL_MS,
    turnoMaxMs: TURNO_MAX_MS,
  })

  
  
  
  await registrarCusto({
    workspaceId: ws,
    conversaId: job.conversa_id,
    modelo,
    
    
    
    
    tokensEntrada: rodada.usoConhecido ? rodada.tokensEntrada : null,
    tokensSaida: rodada.usoConhecido ? rodada.tokensSaida : null,
  })

  if (!rodada.concluiu || !rodada.texto.trim()) {
    return desfecharRodadaSemTexto(job, rodada, chave, agoraIso)
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const pos = await carregarContexto(job, assistenteEscolhido)
  if (
    !pos.conversa ||
    pos.conversa.status !== 'aberta' ||
    pos.conversa.atribuida_a ||
    pos.canal?.agente_ligado !== true
  ) {
    await concluirOuDevolver(job)
    return 'pulou'
  }

  
  
  
  
  
  
  const preEnvio = decidirPreSend({
    snapshotInAt,
    atualInAt: pos.conversa.ultima_msg_in_at,
    descartesSeguidos: job.descartes,
  })
  if (preEnvio.acao === 'descartar') {
    
    
    await requeueJob(job, { descartes: job.descartes + 1 })
    return 'pulou'
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const texto = await comIdentificacao(
    ws,
    job.conversa_id,
    textoParaOCanal(rodada.texto, pos.canal?.provider),
    agoraIso,
  )

  
  const { cortadas } = await enviarMensagem(ws, job.conversa_id, texto, {
    autor: 'agente',
    tetoBolhas: TETO_BOLHAS,
  })
  if (cortadas > 0) await marcarSemDerrubar(ws, job.conversa_id, 'resposta_cortada', agoraIso)

  
  
  
  
  
  const intacto = await concluirSeIntacto(job)
  
  
  
  
  
  
  
  
  
  if (!intacto) await requeueJob(job, { descartes: 0 })
  return 'respondeu'
}


async function comIdentificacao(
  ws: string,
  conversaId: string,
  texto: string,
  agoraIso: string,
): Promise<string> {
  
  
  const { avisosEntregues, ultimoAvisoEm } = await contarAvisosEntregues(ws, conversaId)
  const devida = precisaDisclosure({ avisosEntregues, ultimoAvisoEm, agora: agoraIso })
  
  
  
  
  return devida ? (aplicarDisclosure([texto], linhaDoDisclosure())[0] ?? texto) : texto
}


async function passarParaHumano(ws: string, conversaId: string, agoraIso: string): Promise<void> {
  const { admin } = await import('@/server/supabase')
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const { data, error } = await admin()
    .from('conversas')
    .update({ status: 'aguardando_humano', escalada_em: agoraIso, atualizado_em: agoraIso })
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .eq('status', 'aberta')
    .select('id')
  
  
  
  if (error) throw new Error('falha ao passar a conversa para a fila humana')
  
  
  
  
  
  if (((data as unknown[] | null) ?? []).length === 0) return

  
  
  
  
  
  
  
  
  
  try {
    const texto = await comIdentificacao(ws, conversaId, CONFIRMACAO_HUMANO, agoraIso)
    await enviarMensagem(ws, conversaId, texto, { autor: 'agente', tetoBolhas: TETO_BOLHAS })
  } catch (err) {
    console.warn('[agente/runtime] a confirmacao da rota humana nao saiu:', redigirValores(err, []))
  }
}


async function desfecharRodadaSemTexto(
  job: JobDaFila,
  rodada: RodadaResultado,
  chave: string,
  agoraIso: string,
): Promise<'pulou'> {
  
  
  
  
  
  
  
  
  if (rodada.concluiu) {
    await concluirOuDevolver(job)
    return 'pulou'
  }
  const erro = new Error(rodada.erro?.mensagem ?? 'a rodada terminou sem resposta')
  const codigo = rodada.erro?.codigoHttp ?? null
  
  await requeueComBackoff(job, erro, chave, cortadoPeloPrazo(rodada) ? null : codigo, agoraIso)
  return 'pulou'
}


async function requeueComBackoff(
  job: JobDaFila,
  err: unknown,
  chave: string | null,
  codigoHttp: number | null = codigoDe(err),
  agoraIso: string = new Date().toISOString(),
): Promise<void> {
  const texto = redigirValores(err, chave ? [chave] : [])
  const tentativas = job.tentativas + 1
  const { esperaMs, desistir } = proximaTentativa(tentativas, Date.now())
  const terminal = classificarErroMeta(codigoHttp) === 'desistir'

  if (terminal || desistir || esgotou({ ...job, tentativas })) {
    
    
    
    
    
    
    if (await matarJob(job, texto)) {
      await marcarSemDerrubar(job.workspace_id, job.conversa_id, 'falhou', agoraIso)
    }
    return
  }
  await requeueJob(job, {
    tentativas,
    ultimoErro: texto,
    naoAntes: new Date(Date.now() + esperaMs).toISOString(),
  })
}

function codigoDe(err: unknown): number | null {
  const e = err as { statusCode?: unknown; status?: unknown } | null | undefined
  const bruto = e?.statusCode ?? e?.status
  return typeof bruto === 'number' && Number.isFinite(bruto) ? bruto : null
}
