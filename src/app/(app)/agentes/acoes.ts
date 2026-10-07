'use server'

import { z } from 'zod'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { ehOwnerDoWorkspace } from '@/server/auth/owner-workspace'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { admin } from '@/server/supabase'
import { setSecret } from '@/server/secrets'




import { CHAVE_MODELO, CHAVE_OPENAI } from '@/server/agente/chaves'



import { temPrecoConhecido } from '@/server/agente/custo'




import { TETO_NOME, TETO_SOBRE } from '@/lib/agente/tetos-persona'



import {
  faixasDoFormulario,
  feriadosDoTexto,
  fusoValido,
  TETO_FERIADOS,
  type LinhaDoDia,
} from '@/lib/agente/horario-formulario'
import { detalheSeguro } from '@/lib/sanitizar-erro'
import { fraseDeBanco } from '@/lib/erro-de-banco'



export type ResultadoSimples = { ok: true } | { erro: string }


export type ResultadoComAviso = { ok: true; aviso?: string } | { erro: string }


const PISO_CHAVE = 20

const SO_O_DONO = 'Só quem instalou este CRM pode alterar esta informação.'

const SO_O_OWNER = 'Só quem administra este espaço de trabalho pode alterar esta informação.'
const SEM_WS = 'Você não está em nenhum espaço de trabalho.'

const FUSO_DESCONHECIDO = 'Escolha um dos fusos horários da lista.'

const SEM_ASSISTENTE = 'Não foi possível encontrar o assistente deste espaço de trabalho. Recarregue a página e tente de novo.'

const ASSISTENTE_DESCONHECIDO = 'Esse assistente não existe neste espaço de trabalho. Recarregue a página e tente de novo.'

const CANAL_DESCONHECIDO = 'Esse número não existe mais neste espaço de trabalho. Recarregue a página e tente de novo.'

const PADRAO_NAO_SE_EXCLUI =
  'Este é o assistente padrão: ele responde em todo número que não tem outro escolhido. Marque outro como padrão antes de excluir este.'

const ULTIMO_ASSISTENTE =
  'Este é o único assistente deste espaço de trabalho. Sem nenhum, o assistente responde sem saber nada do seu negócio — edite este em vez de excluí-lo.'


const NAO_GUARDOU = 'Não consegui guardar isso com segurança. Tente de novo.'


const MODELO_SEM_PRECO =
  'Salvo. Só não conheço o preço deste modelo, então o painel "Quanto custou este mês" vai mostrar um valor mínimo em vez do total. Quem cobra é a sua conta de inteligência artificial, e a fatura dela continua sendo a palavra final.'

async function wsDaSessao(): Promise<string | null> {
  const cliente = await criarClienteServidor()
  return resolverWorkspaceAtivo({ cliente })
}


function falha(err: unknown): { erro: string } {
  console.error('[agentes] falha:', detalheSeguro(err))
  return { erro: fraseDeBanco(err) }
}


export async function salvarChaveOpenAI(bruta: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  if (!(await ehDonoDoDeploy())) return { erro: SO_O_DONO }
  const chave = (bruta ?? '').trim()
  if (chave.length < PISO_CHAVE) {
    
    
    return { erro: 'Essa chave é curta demais pra ser uma chave de verdade. Confira e cole de novo.' }
  }
  try {
    
    
    
    
    if (!(await setSecret(CHAVE_OPENAI, chave))) return { erro: NAO_GUARDOU }
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function salvarModelo(bruto: string): Promise<ResultadoComAviso> {
  await exigirEngineLiberado()
  if (!(await ehDonoDoDeploy())) return { erro: SO_O_DONO }
  const modelo = (bruto ?? '').trim()
  if (!modelo) return { erro: 'Escreva o nome do modelo.' }
  if (modelo.length > 100) return { erro: 'Isso não parece o nome de um modelo.' }
  try {
    
    
    
    if (!(await setSecret(CHAVE_MODELO, modelo))) return { erro: NAO_GUARDOU }
    
    
    
    
    
    
    if (!temPrecoConhecido(modelo)) return { ok: true, aviso: MODELO_SEM_PRECO }
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


async function alternar(canalId: string, ligado: boolean): Promise<ResultadoSimples> {
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  try {
    const { data: canais, error } = await admin()
      .from('canais')
      .update({ agente_ligado: ligado, atualizado_em: new Date().toISOString() })
      .eq('workspace_id', ws)
      .eq('id', canalId)
      .select('id')
    if (error) return falha(error)
    if (!canais?.length) return { erro: CANAL_DESCONHECIDO }
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function ligarAgente(canalId: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  if (!(await ehDonoDoDeploy())) return { erro: SO_O_DONO }
  return alternar(canalId, true)
}


export async function desligarAgente(canalId: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  if (!(await ehDonoDoDeploy())) return { erro: SO_O_DONO }
  return alternar(canalId, false)
}


const Persona = z.object({
  nome: z.string().max(TETO_NOME, `O nome pode ter no máximo ${TETO_NOME} caracteres.`),
  tratamento: z.enum(['voce', 'senhor'], { message: 'Escolha uma das duas formas de tratamento.' }),
  sobreONegocio: z
    .string()
    .max(TETO_SOBRE, `O texto pode ter no máximo ${TETO_SOBRE} caracteres.`),
})


const Assistente = Persona.extend({
  nomeInterno: z
    .string()
    .min(1, 'Escreva um nome para você reconhecer este assistente na lista.')
    .max(TETO_NOME, `O nome pode ter no máximo ${TETO_NOME} caracteres.`),
})


export async function atribuirAssistente(
  canalId: string,
  agenteId: string | null,
): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }
  try {
    const db = admin()
    
    
    
    
    
    if (agenteId) {
      const { data: alvo, error: erroAlvo } = await db
        .from('assistentes')
        .select('id')
        .eq('workspace_id', ws)
        .eq('id', agenteId)
        .maybeSingle()
      if (erroAlvo) return falha(erroAlvo)
      if (!alvo) return { erro: ASSISTENTE_DESCONHECIDO }
    }

    const { data: canais, error } = await db
      .from('canais')
      .update({ agente_id: agenteId, atualizado_em: new Date().toISOString() })
      .eq('workspace_id', ws)
      .eq('id', canalId)
      .select('id')
    if (error) return falha(error)
    
    
    if (!canais?.length) return { erro: CANAL_DESCONHECIDO }
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function criarAssistente(dados: {
  nomeInterno: string
  nome: string
  tratamento: string
  sobreONegocio: string
}): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }
  const r = Assistente.safeParse({ ...dados, nomeInterno: (dados.nomeInterno ?? '').trim() })
  if (!r.success) return { erro: r.error.issues[0]?.message ?? 'Confira os campos.' }
  try {
    const db = admin()
    const { data: padrao, error: erroPadrao } = await db
      .from('assistentes')
      .select('id')
      .eq('workspace_id', ws)
      .eq('padrao', true)
      .maybeSingle()
    if (erroPadrao) return falha(erroPadrao)

    const { data: criadas, error } = await db
      .from('assistentes')
      .insert({
        workspace_id: ws,
        nome_interno: r.data.nomeInterno,
        nome: r.data.nome,
        tratamento: r.data.tratamento,
        sobre_o_negocio: r.data.sobreONegocio,
        padrao: !padrao,
      })
      .select('id')
    if (error) return falha(error)
    if (!criadas?.length) return { erro: SEM_ASSISTENTE }
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function editarAssistente(dados: {
  id: string
  nomeInterno: string
  nome: string
  tratamento: string
  sobreONegocio: string
}): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }
  const r = Assistente.safeParse({ ...dados, nomeInterno: (dados.nomeInterno ?? '').trim() })
  if (!r.success) return { erro: r.error.issues[0]?.message ?? 'Confira os campos.' }
  try {
    const { data: gravadas, error } = await admin()
      .from('assistentes')
      .update({
        nome_interno: r.data.nomeInterno,
        nome: r.data.nome,
        tratamento: r.data.tratamento,
        sobre_o_negocio: r.data.sobreONegocio,
        atualizado_em: new Date().toISOString(),
      })
      .eq('workspace_id', ws)
      .eq('id', dados.id)
      .select('id')
    if (error) return falha(error)
    if (!gravadas?.length) return { erro: ASSISTENTE_DESCONHECIDO }
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function excluirAssistente(id: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }
  try {
    const db = admin()
    
    
    const { data: todos, error: erroLista } = await db
      .from('assistentes')
      .select('id, padrao')
      .eq('workspace_id', ws)
    if (erroLista) return falha(erroLista)
    const lista = (todos ?? []) as Array<{ id: string; padrao: boolean | null }>
    const alvo = lista.find((a) => a.id === id)
    if (!alvo) return { erro: ASSISTENTE_DESCONHECIDO }
    
    
    
    
    if (lista.length <= 1) return { erro: ULTIMO_ASSISTENTE }
    if (alvo.padrao) return { erro: PADRAO_NAO_SE_EXCLUI }

    const { data: apagadas, error } = await db
      .from('assistentes')
      .delete()
      .eq('workspace_id', ws)
      .eq('id', id)
      
      
      
      
      
      
      
      
      
      
      .eq('padrao', false)
      .select('id')
    if (error) return falha(error)
    if (!apagadas?.length) return { erro: ASSISTENTE_DESCONHECIDO }
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function definirAssistentePadrao(id: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }
  try {
    const { data, error } = await admin().rpc('definir_assistente_padrao', { p_ws: ws, p_id: id })
    if (error) return falha(error)
    
    
    if (!data) return { erro: ASSISTENTE_DESCONHECIDO }
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function salvarHorarioAtendimento(dados: {
  fuso: string
  linhas: LinhaDoDia[]
  feriados: string
}): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: SEM_WS }
  if (!(await ehOwnerDoWorkspace(ws))) return { erro: SO_O_OWNER }
  if (!fusoValido(dados.fuso)) return { erro: FUSO_DESCONHECIDO }
  if (!Array.isArray(dados.linhas)) return { erro: 'Confira os horários de cada dia.' }
  const faixas = faixasDoFormulario(dados.linhas)
  if ('erro' in faixas) return { erro: faixas.erro }
  const feriados = feriadosDoTexto(typeof dados.feriados === 'string' ? dados.feriados : '')
  if ('erro' in feriados) return { erro: feriados.erro }
  if (feriados.feriados.length > TETO_FERIADOS) {
    return { erro: `São no máximo ${TETO_FERIADOS} feriados. Apague os que já passaram.` }
  }
  try {
    
    
    
    
    const { error } = await admin()
      .from('horario_atendimento')
      .upsert(
        {
          workspace_id: ws,
          fuso: dados.fuso,
          faixas: faixas.faixas,
          feriados: feriados.feriados,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' },
      )
    if (error) return falha(error)
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}
