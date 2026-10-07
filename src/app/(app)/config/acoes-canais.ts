'use server'

import { exigirEngineLiberado } from '@/server/license/exigir'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { gravarConfig } from '@/server/configuracoes'
import { setSecret } from '@/server/secrets'
import { CHAVE_ADMIN } from '@/server/canais/segredos'
import { PISO_SEGREDO_CANAL } from '@/server/canais/types'
import { CHAVE_URL_PUBLICA, normalizarUrlPublica } from '@/lib/canais/url-publica'
import { qrParaImagem } from '@/lib/canais/qr'
import {
  criarCanal,
  criarCanalCloud,
  criarCanalInstagram,
  editarConfig,
  excluirCanal,
  reconectarCanal,
  registrarWebhookDoCanal,
} from '@/server/canais/conexao'
import { mensagemSegura } from '@/lib/sanitizar-erro'



export type ResultadoSimples = { ok: true } | { erro: string }

async function wsDaSessao(): Promise<string | null> {
  const cliente = await criarClienteServidor()
  return resolverWorkspaceAtivo({ cliente })
}


function falha(err: unknown): { erro: string } {
  return { erro: mensagemSegura(err) }
}


const SO_O_DONO = 'Só quem instalou este CRM pode alterar estas duas informações.'


export async function salvarUrlPublica(
  bruta: string,
): Promise<{ ok: true; origem: string } | { erro: string }> {
  await exigirEngineLiberado()
  if (!(await ehDonoDoDeploy())) return { erro: SO_O_DONO }
  const r = normalizarUrlPublica(bruta)
  if (!r.ok) {
    const texto =
      r.erro === 'vazia'
        ? 'Escreva o endereço do seu CRM.'
        : r.erro === 'exige_https'
          ? 'O endereço precisa começar com https:// — o servidor de mensagens manda a senha do canal nessa URL.'
          : 'Isso não parece um endereço. Use algo como https://crm.suaempresa.com.br'
    return { erro: texto }
  }
  try {
    await gravarConfig(CHAVE_URL_PUBLICA, r.origem)
    return { ok: true, origem: r.origem }
  } catch (err) {
    return falha(err)
  }
}


export async function salvarAdminToken(bruto: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  if (!(await ehDonoDoDeploy())) return { erro: SO_O_DONO }
  const token = (bruto ?? '').trim()
  
  
  
  
  
  
  if (token.length < PISO_SEGREDO_CANAL) {
    return { erro: 'Esse token é curto demais pra ser um token de verdade.' }
  }
  try {
    await setSecret(CHAVE_ADMIN, token)
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function conectarCanal(dados: {
  nome: string
  serverUrl: string
}): Promise<{ ok: true; canalId: string } | { erro: string }> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: 'Você não está em nenhum espaço de trabalho.' }
  try {
    const { canalId } = await criarCanal(ws, dados)
    return { ok: true, canalId }
  } catch (err) {
    return falha(err)
  }
}


export async function conectarCanalCloud(dados: {
  nome: string
  phoneNumberId: string
  accessToken: string
  appSecret: string
  verifyToken: string
}): Promise<{ ok: true; canalId: string; urlDoWebhook: string } | { erro: string }> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: 'Você não está em nenhum espaço de trabalho.' }
  try {
    const { canalId, urlDoWebhook } = await criarCanalCloud(ws, dados)
    return { ok: true, canalId, urlDoWebhook }
  } catch (err) {
    return falha(err)
  }
}


export async function conectarCanalInstagram(dados: {
  nome: string
  contaId: string
  accessToken: string
  appSecret: string
  verifyToken: string
}): Promise<{ ok: true; canalId: string; urlDoWebhook: string } | { erro: string }> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: 'Você não está em nenhum espaço de trabalho.' }
  try {
    const { canalId, urlDoWebhook } = await criarCanalInstagram(ws, dados)
    return { ok: true, canalId, urlDoWebhook }
  } catch (err) {
    return falha(err)
  }
}


export async function gerarQr(
  canalId: string,
): Promise<{ ok: true; qr: string | null } | { erro: string }> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: 'Você não está em nenhum espaço de trabalho.' }
  try {
    const { qr } = await reconectarCanal(ws, canalId)
    return { ok: true, qr: qrParaImagem(qr) }
  } catch (err) {
    return falha(err)
  }
}


export async function salvarServerUrl(canalId: string, serverUrl: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: 'Você não está em nenhum espaço de trabalho.' }
  try {
    await editarConfig(ws, canalId, { server_url: serverUrl })
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function removerCanal(canalId: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: 'Você não está em nenhum espaço de trabalho.' }
  try {
    await excluirCanal(ws, canalId)
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function religarRecebimento(canalId: string): Promise<ResultadoSimples> {
  await exigirEngineLiberado()
  const ws = await wsDaSessao()
  if (!ws) return { erro: 'Você não está em nenhum espaço de trabalho.' }
  try {
    await registrarWebhookDoCanal(ws, canalId)
    return { ok: true }
  } catch (err) {
    return falha(err)
  }
}


export async function contarConversasDoCanal(
  canalId: string,
): Promise<{ conversas: number } | { erro: string }> {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return { erro: 'sem_workspace' }
  const { count, error } = await cliente
    .from('conversas')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ws)
    .eq('canal_id', canalId)
  
  
  if (error || count === null) return { erro: 'nao_contei' }
  return { conversas: count }
}
