
import 'server-only'
import { criarOrcamento, type Orcamento } from '@/lib/orcamento-tick'
import { admin } from '@/server/supabase'
import { lerCredenciais } from '@/server/canais/segredos'
import { getProvider } from '@/server/canais/registry'
import { classificarErroMeta } from '@/lib/canais/erroMeta'




import { redeDaJanela, textoErroForaDaJanela, type RedeDaJanela } from '@/lib/canais/janela24h'

import { proximaTentativa } from '@/lib/canais/politicaRetry'
import { redigirValores } from '@/lib/canais/redigir'
import { splitMensagem } from '@/lib/canais/splitMensagem'
import { segredosDe } from '@/server/canais/types'
import type { CanalAdapter, CanalCreds, EnvioResultado } from '@/server/canais/types'


export class ErroDeEnvio extends Error {
  constructor(
    
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = new.target.name
  }
}

export class CanalSemEndereco extends ErroDeEnvio {
  constructor() {
    super(
      'canal_sem_endereco',
      'Este canal está sem o endereço do servidor de mensagens. Salve-o na linha deste canal antes de continuar.',
    )
  }
}


export class ConversaNaoEncontrada extends ErroDeEnvio {
  constructor() {
    super(
      'conversa_nao_encontrada',
      'Esta conversa não existe neste espaço de trabalho. Recarregue a página: ela pode ter sido apagada.',
    )
  }
}

export class CanalNaoEncontrado extends ErroDeEnvio {
  constructor() {
    super(
      'canal_nao_encontrado',
      'Este canal não existe neste espaço de trabalho. Recarregue a página: ele pode ter sido apagado.',
    )
  }
}


export const ORFAO_MS = 15 * 60_000


export const ENVIO_INTERROMPIDO =
  'O envio foi interrompido e não sabemos se chegou ao cliente; confira o WhatsApp antes de reenviar.'


const LOTE = 20

type LinhaFila = {
  id: string
  workspace_id: string
  conversa_id: string
  texto: string
  tentativas: number | null
  enviando_desde: string | null
}

type Contexto = {
  canalId: string
  
  provider: string
  
  serverUrl: string
  
  externalId: string | null
  destino: string
}


async function contexto(ws: string, conversaId: string): Promise<Contexto> {
  const { data: conversa } = await admin()
    .from('conversas')
    .select('id, canal_id, chave_externa')
    .eq('workspace_id', ws)
    .eq('id', conversaId)
    .maybeSingle()
  const c = conversa as { canal_id: string; chave_externa: string } | null
  if (!c) throw new ConversaNaoEncontrada()

  const { data: canal } = await admin()
    .from('canais')
    
    
    
    
    
    
    
    
    
    
    
    
    .select('id, provider, config, external_id')
    .eq('workspace_id', ws)
    .eq('id', c.canal_id)
    .maybeSingle()
  const k = canal as {
    provider?: string
    config?: { server_url?: string }
    external_id?: string | null
  } | null
  if (!k) throw new CanalNaoEncontrado()

  
  
  
  
  return {
    canalId: c.canal_id,
    provider: typeof k.provider === 'string' ? k.provider : '',
    serverUrl: typeof k.config?.server_url === 'string' ? k.config.server_url : '',
    externalId: typeof k.external_id === 'string' ? k.external_id : null,
    destino: destinoDe(c.chave_externa),
  }
}


type Preparo =
  | { pode: true; adapter: CanalAdapter; creds: CanalCreds | null; segredos: string[] }
  | { pode: false; erro: string; terminal: boolean; segredos: string[] }


async function preparar(ctx: Contexto): Promise<Preparo> {
  const adapter = getProvider(ctx.provider)
  if (!adapter) {
    
    
    
    
    
    
    return {
      pode: false,
      terminal: true,
      erro: 'Este canal usa um tipo de conexão que esta versão do CRM não conhece.',
      segredos: [],
    }
  }

  if (!adapter.capabilities.precisaCredencial) {
    return { pode: true, adapter, creds: null, segredos: [] }
  }

  const r = await lerCredenciais({
    id: ctx.canalId,
    provider: ctx.provider,
    serverUrl: ctx.serverUrl,
    externalId: ctx.externalId,
  })
  
  
  
  if (r.creds === null && r.motivo === 'sem_config') {
    throw new CanalSemEndereco()
  }
  if (r.creds === null) {
    return {
      pode: false,
      terminal: false,
      erro: 'canal sem credencial configurada',
      segredos: [ctx.serverUrl].filter(Boolean),
    }
  }
  return { pode: true, adapter, creds: r.creds, segredos: segredosDe(r.creds) }
}


async function desfecharEnvio(
  preparo: Preparo,
  destino: string,
  texto: string,
  tentativas: number,
  agoraMs: number,
): Promise<Record<string, unknown>> {
  if (!preparo.pode) {
    return preparo.terminal
      ? desfechoTerminal(redigirValores(preparo.erro, preparo.segredos), tentativas, agoraMs)
      : desfecho({ ok: false, erro: preparo.erro, codigoHttp: null }, tentativas, agoraMs, preparo.segredos, null)
  }
  const r = await enviarComSeguranca(preparo.adapter, preparo.creds, destino, texto)
  
  
  
  
  return desfecho(r, tentativas, agoraMs, preparo.segredos, redeDaJanela(preparo.adapter.slug))
}


export function destinoDe(chaveExterna: string): string {
  const corte = chaveExterna.indexOf('@')
  return corte === -1 ? chaveExterna : chaveExterna.slice(0, corte)
}


function desfecho(
  r: EnvioResultado,
  tentativas: number,
  agoraMs: number,
  segredos: string[],
  
  rede: RedeDaJanela | null,
): Record<string, unknown> {
  
  
  
  if (r.ok) {
    return {
      status: 'enviada',
      externo_id: r.externalId,
      enviando_desde: null,
      ultimo_erro: null,
      proxima_tentativa: null,
    }
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const erro =
    rede && r.codigoProvider === rede.codigoForaDaJanela
      ? textoErroForaDaJanela(rede.nome)
      : r.causa === 'timeout'
        ? ENVIO_INTERROMPIDO
        : redigirValores(r.erro, segredos)
  const acao = classificarErroMeta(r.codigoHttp, undefined, r.causa)
  const { esperaMs, desistir } = proximaTentativa(tentativas, agoraMs)

  if (acao === 'desistir' || desistir) return desfechoTerminal(erro, tentativas, agoraMs)
  return {
    status: 'pendente',
    enviando_desde: null,
    ultimo_erro: erro,
    tentativas: tentativas + 1,
    proxima_tentativa: new Date(agoraMs + esperaMs).toISOString(),
  }
}


function desfechoTerminal(
  erro: string,
  tentativas: number,
  agoraMs: number,
): Record<string, unknown> {
  return {
    status: 'falhou',
    enviando_desde: null,
    ultimo_erro: erro,
    desistido_em: new Date(agoraMs).toISOString(),
    tentativas: tentativas + 1,
  }
}


async function gravarDesfecho(
  ws: string,
  id: string,
  dados: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin()
    .from('mensagens')
    .update(dados)
    .eq('workspace_id', ws)
    .eq('id', id)
  if (error) console.warn('[canais/envio] desfecho nao gravado:', redigirValores(error, []))
}


async function moverConversa(ws: string, conversaId: string, quando: string): Promise<void> {
  const { error } = await admin().rpc('registrar_mensagem_na_conversa', {
    p_ws: ws,
    p_conversa: conversaId,
    p_quando: quando,
    p_entrada: false,
  })
  if (error) {
    console.warn('[canais/envio] conversa nao movida na caixa de entrada:', redigirValores(error, []))
  }
}


export async function enviarMensagem(
  workspaceId: string,
  conversaId: string,
  texto: string,
  opcoes: { autor?: 'membro' | 'agente'; tetoBolhas?: number } = {},
): Promise<{ bolhas: number; cortadas: number }> {
  const todos = splitMensagem(texto)
  
  
  
  const teto = opcoes.tetoBolhas
  const pedacos = typeof teto === 'number' && teto > 0 ? todos.slice(0, teto) : todos
  const cortadas = todos.length - pedacos.length
  
  
  
  
  if (pedacos.length === 0) return { bolhas: 0, cortadas: 0 }

  const ctx = await contexto(workspaceId, conversaId)
  
  
  const preparo = await preparar(ctx)

  
  
  
  
  
  
  
  
  
  
  let travado: string | null = null

  
  
  
  
  
  
  
  
  let anterior: string | null = null

  for (const pedaco of pedacos) {
    
    
    const origemEm = new Date().toISOString()

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const reserva = travado
      ? { enviando_desde: null, proxima_tentativa: travado }
      : {
          enviando_desde: origemEm,
          proxima_tentativa: new Date(Date.parse(origemEm) + ORFAO_MS).toISOString(),
        }

    
    
    
    
    
    const { data: linha } = (await admin()
      .from('mensagens')
      .insert({
        workspace_id: workspaceId,
        conversa_id: conversaId,
        
        
        
        direcao: 'saida',
        autor: opcoes.autor ?? 'membro',
        texto: pedaco,
        status: 'pendente',
        origem_em: origemEm,
        tentativas: 0,
        predecessora_id: anterior,
        ...reserva,
      })
      .select('id')
      .single()) as { data: { id: string } | null }

    const id = linha?.id
    if (!id) throw new Error('Não consegui gravar esta mensagem agora. Tente de novo em alguns instantes.')
    
    
    
    anterior = id

    
    await moverConversa(workspaceId, conversaId, origemEm)

    
    
    if (travado) continue

    const agora = Date.now()
    const dados = await desfecharEnvio(preparo, ctx.destino, pedaco, 0, agora)
    await gravarDesfecho(workspaceId, id, dados)
    if (dados.status !== 'enviada') {
      travado = (dados.proxima_tentativa as string | undefined) ?? new Date(agora).toISOString()
    }
  }

  return { bolhas: pedacos.length, cortadas }
}


async function soltarReserva(orcamento: Orcamento, linhas: LinhaFila[]): Promise<void> {
  const agora = new Date().toISOString()
  for (const linha of linhas) {
    const carimbo = linha.enviando_desde ? Date.parse(linha.enviando_desde) : Number.NaN
    const nosso = !Number.isFinite(carimbo) || carimbo >= orcamento.comecoMs
    await gravarDesfecho(linha.workspace_id, linha.id, {
      proxima_tentativa: agora,
      ...(nosso ? { enviando_desde: null } : {}),
    })
  }
}


async function enviarComSeguranca(
  adapter: CanalAdapter,
  creds: CanalCreds | null,
  destino: string,
  texto: string,
): Promise<EnvioResultado> {
  try {
    return await adapter.enviarTexto(creds, destino, texto)
  } catch (err) {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    return { ok: false, erro: redigirValores(err, creds ? segredosDe(creds) : []), codigoHttp: null }
  }
}


export async function drenarFila(orcamento: Orcamento = criarOrcamento(Date.now())): Promise<void> {
  
  
  
  
  if (!orcamento.cabe('fila')) return

  const { data, error: erroReserva } = await admin().rpc('reservar_mensagens', {
    p_limite: LOTE,
    
    
    p_reserva: `${ORFAO_MS} milliseconds`,
  })
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (erroReserva) throw erroReserva

  const linhas = (data ?? []) as LinhaFila[]
  for (let i = 0; i < linhas.length; i++) {
    const bruta = linhas[i]
    const agora = Date.now()
    const ws = bruta.workspace_id
    const tentativas = bruta.tentativas ?? 0

    
    
    
    const emVoo = bruta.enviando_desde ? agora - Date.parse(bruta.enviando_desde) : 0
    if (emVoo > ORFAO_MS) {
      await gravarDesfecho(ws, bruta.id, {
        status: 'falhou',
        enviando_desde: null,
        desistido_em: new Date(agora).toISOString(),
        ultimo_erro: ENVIO_INTERROMPIDO,
      })
      continue
    }

    
    
    
    
    
    
    
    
    
    if (!orcamento.cabe('fila')) {
      await soltarReserva(orcamento, linhas.slice(i))
      break
    }

    let dados: Record<string, unknown>
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    let segredos: string[] = []
    try {
      const ctx = await contexto(ws, bruta.conversa_id)
      segredos = [...segredos, ...[ctx.serverUrl].filter(Boolean)]
      const preparo = await preparar(ctx)
      segredos = [...segredos, ...preparo.segredos]
      dados = await desfecharEnvio(preparo, ctx.destino, bruta.texto, tentativas, agora)
    } catch (err) {
      
      
      
      
      
      
      
      
      
      
      dados = desfecho({ ok: false, erro: redigirValores(err, segredos), codigoHttp: null }, tentativas, agora, segredos, null)
    }

    await gravarDesfecho(ws, bruta.id, dados)
  }
}
