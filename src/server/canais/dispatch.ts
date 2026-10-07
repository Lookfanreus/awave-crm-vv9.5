
import 'server-only'
import { admin } from '@/server/supabase'
import { mesmoTelefone, sufixoTelefone } from '@/lib/canais/telefone'
import { aplicarStatusEntrega, type StatusMensagem } from '@/lib/canais/janela'
import { BALDE_CONTATO_NOVO, consumir, type EstadoBalde } from '@/lib/canais/rateLimit'
import {
  agendarJob,
  encerrarPausaDoAparelho,
  garantirJob,
  pausarPorAparelho,
} from '@/server/agente/jobs'
import { temTextoParaOModelo } from '@/lib/canais/historico-agente'
import { origemDoCanal } from '@/server/canais/origem-do-canal'
import type { CanalRow } from '@/server/canais/registry'
import type { CanalEvent, InboundMidia } from '@/server/canais/types'


export class FalhaDeBanco extends Error {}


const BALDES_CONTATO = new Map<string, EstadoBalde>()


function ehDuplicata(erro: { code?: string } | null | undefined): boolean {
  return erro?.code === '23505'
}


export type PerfilDeIdentidade = {
  
  porTelefone: boolean
  
  namespace: string | null
  
  origem: string
}


type FichaDeContato = {
  nome: string
  telefone?: string | null
  telefone_sufixo?: string | null
  identidade_canal?: string | null
  identidade_externa?: string | null
  
  perfil_pendente?: boolean
}


type Casamento = { casou: true; id: string } | { casou: false; ficha: FichaDeContato }


async function casarPorTelefone(
  workspaceId: string,
  evento: Extract<CanalEvent, { tipo: 'mensagem' }>,
): Promise<Casamento | null> {
  if (!evento.remetente) return null

  const sufixo = sufixoTelefone(evento.remetente)
  if (!sufixo) return null

  const { data: candidatos, error: erroLeitura } = await admin()
    .from('contatos')
    .select('id, telefone, criado_em')
    .eq('workspace_id', workspaceId)
    .eq('telefone_sufixo', sufixo)
    .order('criado_em', { ascending: true })

  
  
  
  
  
  if (erroLeitura) throw new FalhaDeBanco('falha ao ler os candidatos de contato')

  for (const c of (candidatos ?? []) as Array<{ id: string; telefone: string }>) {
    
    if (mesmoTelefone(c.telefone, evento.remetente)) return { casou: true, id: c.id }
  }

  return {
    casou: false,
    ficha: {
      
      
      
      nome: evento.nomeRemetente || evento.remetente,
      telefone: evento.remetente,
      telefone_sufixo: sufixo,
    },
  }
}


async function casarPorIdentidade(
  workspaceId: string,
  evento: Extract<CanalEvent, { tipo: 'mensagem' }>,
  perfil: PerfilDeIdentidade,
): Promise<Casamento | null> {
  
  
  
  const identidade = (evento.identidadeExterna ?? '').trim()
  if (!identidade) return null

  const namespace = perfil.namespace
  if (!namespace) return null

  const { data, error: erroLeitura } = await admin()
    .from('contatos')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('identidade_canal', namespace)
    .eq('identidade_externa', identidade)
    .maybeSingle()

  
  
  
  if (erroLeitura) throw new FalhaDeBanco('falha ao ler o contato por identidade de canal')

  const achado = data as { id: string } | null
  if (achado) return { casou: true, id: achado.id }

  return {
    casou: false,
    ficha: {
      
      
      nome: evento.nomeRemetente || identidade,
      telefone: null,
      telefone_sufixo: null,
      identidade_canal: namespace,
      identidade_externa: identidade,
      
      
      
      
      
      
      
      ...(evento.nomeRemetente ? {} : { perfil_pendente: true }),
    },
  }
}


export async function resolverContato(
  workspaceId: string,
  canalId: string,
  evento: Extract<CanalEvent, { tipo: 'mensagem' }>,
  perfil: PerfilDeIdentidade,
): Promise<string | null> {
  if (evento.origem !== 'contato') return null
  if (evento.tipoChat !== 'individual') return null

  const casamento = perfil.porTelefone
    ? await casarPorTelefone(workspaceId, evento)
    : await casarPorIdentidade(workspaceId, evento, perfil)

  
  if (!casamento) return null
  if (casamento.casou) return casamento.id

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (!consumir(BALDES_CONTATO, BALDE_CONTATO_NOVO, canalId, Date.now())) return null

  
  
  
  const { data: novo } = await admin()
    .from('contatos')
    .insert({
      workspace_id: workspaceId,
      origem: perfil.origem,
      ...casamento.ficha,
    })
    .select('id')
    .single()

  
  
  
  
  
  return (novo as { id: string } | null)?.id ?? null
}


export type MidiaJson = {
  kind: InboundMidia['kind']
  mime?: string
  refExterna: string
  legenda?: string
  
  status: 'pendente' | 'ok' | 'erro'
  
  caminho?: string
  
  tentativas?: number
  
  reservadaAte?: string
}

export function midiaParaJson(midia: InboundMidia | null): MidiaJson | null {
  if (!midia) return null
  return {
    kind: midia.kind,
    mime: midia.mime,
    refExterna: midia.refExterna.valor,
    legenda: midia.legenda,
    
    
    
    status: 'pendente',
  }
}


export async function garantirConversa(
  ws: string,
  canalId: string,
  chaveExterna: string,
  contatoId: string | null,
): Promise<string> {
  const achar = async () =>
    await admin()
      .from('conversas')
      .select('id, contato_id')
      .eq('workspace_id', ws)
      .eq('canal_id', canalId)
      .eq('chave_externa', chaveExterna)
      .maybeSingle()

  const { data: existente, error: erroLeitura } = await achar()
  if (erroLeitura) throw new FalhaDeBanco('falha ao ler a conversa')

  if (existente) {
    const linha = existente as { id: string; contato_id: string | null }
    
    
    
    
    if (contatoId && !linha.contato_id) {
      await admin()
        .from('conversas')
        .update({ contato_id: contatoId })
        .eq('workspace_id', ws)
        .eq('id', linha.id)
        .is('contato_id', null)
    }
    return linha.id
  }

  const { data: nova, error: erroInsert } = await admin()
    .from('conversas')
    .insert({ workspace_id: ws, canal_id: canalId, chave_externa: chaveExterna, contato_id: contatoId })
    .select('id')
    .single()
  if (nova) return (nova as { id: string }).id
  if (!ehDuplicata(erroInsert)) throw new FalhaDeBanco('falha ao criar a conversa')

  const { data: depois, error: erroRele } = await achar()
  if (erroRele || !depois) throw new FalhaDeBanco('conversa duplicada mas ilegivel')
  return (depois as { id: string }).id
}


export async function aplicarAck(
  ws: string,
  ev: Extract<CanalEvent, { tipo: 'status' }>,
): Promise<void> {
  const { data, error } = await admin()
    .from('mensagens')
    .select('id, status')
    .eq('workspace_id', ws)
    .eq('externo_id', ev.externalId)
    .maybeSingle()
  if (error) throw new FalhaDeBanco('falha ao ler a mensagem do ack')
  if (!data) return

  const linha = data as { id: string; status: StatusMensagem }
  const proximo = aplicarStatusEntrega(linha.status, ev.status)
  
  
  if (proximo === linha.status) return

  const { error: erroUpdate } = await admin()
    .from('mensagens')
    .update({ status: proximo, enviando_desde: null })
    .eq('workspace_id', ws)
    .eq('id', linha.id)
    .eq('status', linha.status)
  if (erroUpdate) throw new FalhaDeBanco('falha ao aplicar o ack')
}


export async function despachar(
  canal: CanalRow,
  eventos: CanalEvent[],
  
  identidadePorTelefone: boolean,
): Promise<void> {
  const ws = canal.workspace_id
  
  
  
  const perfil: PerfilDeIdentidade = {
    porTelefone: identidadePorTelefone,
    namespace: canal.external_id,
    origem: origemDoCanal(canal.provider),
  }
  
  
  
  
  const agora = Date.now()

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const agenteLigado = canal.agente_ligado === true

  for (const ev of eventos) {
    if (ev.tipo === 'status') {
      await aplicarAck(ws, ev)
      continue
    }
    if (ev.tipo === 'conexao') {
      const { error } = await admin()
        .from('canais')
        .update({ status_conexao: ev.conectado ? 'conectado' : 'desconectado' })
        .eq('workspace_id', ws)
        .eq('id', canal.id)
      if (error) throw new FalhaDeBanco('falha ao atualizar o canal')
      continue
    }

    
    
    
    
    
    
    const contatoId = ev.origem === 'contato' ? await resolverContato(ws, canal.id, ev, perfil) : null
    const conversaId = await garantirConversa(ws, canal.id, ev.conversaExterna, contatoId)

    
    
    
    
    
    const { data: inserida, error } = await admin()
      .from('mensagens')
      .insert({
        workspace_id: ws,
        conversa_id: conversaId,
        externo_id: ev.externalId,
        direcao: ev.origem === 'contato' ? 'entrada' : 'saida',
        autor: ev.origem,
        
        
        
        
        texto: ev.texto,
        midia: midiaParaJson(ev.midia),
        status: ev.origem === 'contato' ? 'recebida' : 'enviada',
        origem_em: ev.timestamp,
      })
      .select('id')
      .single()

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    if (ehDuplicata(error)) {
      const { error: erroAtraso } = await admin().rpc('recuperar_conversa_atrasada', {
        p_ws: ws,
        p_conversa: conversaId,
        p_externo_id: ev.externalId,
      })
      
      
      if (erroAtraso) throw new FalhaDeBanco('falha ao atualizar a conversa')
      
      
      
      
      
      
      
      
      
      
      
      if (agenteLigado && ev.origem === 'contato' && ev.tipoChat === 'individual') {
        await garantirJob(ws, conversaId, agora)
      }
      continue 
    }
    if (error || !inserida) throw new FalhaDeBanco('falha ao gravar a mensagem')

    
    
    
    
    
    
    const { error: erroConversa } = await admin().rpc('registrar_mensagem_na_conversa', {
      p_ws: ws,
      p_conversa: conversaId,
      p_quando: ev.timestamp,
      p_entrada: ev.origem === 'contato',
    })
    if (erroConversa) throw new FalhaDeBanco('falha ao atualizar a conversa')

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    if (!agenteLigado) continue
    if (ev.origem === 'contato') {
      if (ev.tipoChat !== 'individual') continue
      
      
      if (temTextoParaOModelo(ev.texto)) await agendarJob(ws, conversaId, agora)
      else await encerrarPausaDoAparelho(ws, conversaId, agora)
    } else {
      
      
      
      
      
      await pausarPorAparelho(ws, conversaId, new Date(agora).toISOString())
    }
  }
}


despachar.registrarRejeicao = async (canal: CanalRow): Promise<void> => {
  await admin().rpc('incrementar_rejeicoes_canal', { p_ws: canal.workspace_id, p_canal: canal.id })
}


despachar.registrarRejeicaoDeAssinatura = async (canal: CanalRow): Promise<void> => {
  await admin().rpc('incrementar_rejeicoes_assinatura', {
    p_ws: canal.workspace_id,
    p_canal: canal.id,
  })
}
