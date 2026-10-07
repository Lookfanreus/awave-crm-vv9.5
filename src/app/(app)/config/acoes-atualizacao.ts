'use server'

import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { getSecret, setSecret } from '@/server/secrets'
import { refDaRelease } from '@/server/versao'
import { readLicenseCache } from '@/server/license/cache'
import { normalizarRepo, pareceTokenGitHub, estadoDoCard, type EstadoAtualizacao } from '@/lib/atualizacao'
import {
  lerEstado,
  lerResultadoGatilho,
  estaEmAndamento,
  estaPreso,
  esperaDoRebuildTerminou,
  erroEhDeOutroContainer,
  type EstadoDaAtualizacao,
  type ResultadoGatilho,
} from '@/lib/estado-atualizacao'
import { mascararGatilho, pareceUrlDeGatilho } from '@/lib/gatilho-implantacao'
import { SEGREDO_GATILHO, CHAVE_GATILHO } from '@/server/atualizacao/gatilho'
import { totalDivergente, type RelatorioDivergencia } from '@/lib/manifesto-diff'
import { lerConfig } from '@/server/configuracoes'
import {
  aplicarAtualizacao,
  lerEstadoBruto,
  CHAVE_DIVERGENCIA,
  CHAVE_ULTIMO_COMMIT,
} from '@/server/atualizacao/aplicar'
import { reverterAtualizacao } from '@/server/atualizacao/reverter'

export type VistaAtualizacao = {
  estado: EstadoAtualizacao
  versaoAtual: string | null
  versaoMaisNova: string | null
  temToken: boolean
  repo: string | null
  
  andamento: EstadoDaAtualizacao | null
  
  divergentes: number | null
  
  podeReverter: boolean
  
  gatilho: string | null
  
  resultadoGatilho: ResultadoGatilho | null
}




function inicioDoProcessoMs(): number {
  return Date.now() - process.uptime() * 1000
}

async function montarVista(): Promise<VistaAtualizacao> {
  const [token, repo, cache, chave, estadoBruto, divergenciaBruta, ultimoCommit, gatilhoCru, gatilhoBruto] = await Promise.all([
    getSecret('github_token'),
    getSecret('update_repo'),
    readLicenseCache(),
    
    
    
    getSecret('license_key'),
    lerEstadoBruto(),
    lerConfig(CHAVE_DIVERGENCIA),
    lerConfig(CHAVE_ULTIMO_COMMIT),
    getSecret(SEGREDO_GATILHO),
    lerConfig(CHAVE_GATILHO),
  ])
  const versaoAtual = refDaRelease()
  
  
  
  const versaoMaisNova = (cache as { latest_version?: string } | null)?.latest_version ?? null
  const licencaAtiva = cache?.hub_status === 'active' && cache?.entitled === true

  
  
  
  
  
  
  
  
  
  
  
  
  
  const bruto = lerEstado(estadoBruto)
  const inicio = inicioDoProcessoMs()
  const andamento =
    estaPreso(bruto) ||
    esperaDoRebuildTerminou(bruto, inicio) ||
    erroEhDeOutroContainer(bruto, inicio)
      ? null
      : bruto

  let divergentes: number | null = null
  if (divergenciaBruta) {
    try {
      divergentes = totalDivergente(JSON.parse(divergenciaBruta) as RelatorioDivergencia)
    } catch {
      divergentes = null
    }
  }

  return {
    estado: estadoDoCard({ temChave: !!chave?.trim(), licencaAtiva, temToken: !!token, temRepo: !!repo, versaoAtual, versaoMaisNova }),
    versaoAtual,
    versaoMaisNova,
    temToken: !!token,
    repo: repo || null,
    andamento,
    divergentes,
    podeReverter: !!ultimoCommit,
    
    gatilho: mascararGatilho(gatilhoCru),
    resultadoGatilho: lerResultadoGatilho(gatilhoBruto),
  }
}

export async function lerAtualizacao(): Promise<VistaAtualizacao | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  return montarVista()
}


export async function salvarTokenGitHub(token: string): Promise<{ ok: true; vista: VistaAtualizacao } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  const t = String(token ?? '').trim()
  if (!t) return { erro: 'token_vazio' }
  if (!pareceTokenGitHub(t)) return { erro: 'token_formato' }
  try {
    await setSecret('github_token', t)
    return { ok: true, vista: await montarVista() }
  } catch {
    return { erro: 'falha_ao_salvar' }
  }
}


export async function salvarGatilho(entrada: string): Promise<{ ok: true; vista: VistaAtualizacao } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  const u = String(entrada ?? '').trim()
  
  if (u && !pareceUrlDeGatilho(u)) return { erro: 'gatilho_formato' }
  try {
    await setSecret(SEGREDO_GATILHO, u)
    return { ok: true, vista: await montarVista() }
  } catch {
    return { erro: 'falha_ao_salvar' }
  }
}

export async function salvarRepo(entrada: string): Promise<{ ok: true; vista: VistaAtualizacao } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  const r = normalizarRepo(entrada)
  if ('erro' in r) return r
  try {
    await setSecret('update_repo', r.repo)
    return { ok: true, vista: await montarVista() }
  } catch {
    return { erro: 'falha_ao_salvar' }
  }
}


export async function removerTokenGitHub(): Promise<{ ok: true; vista: VistaAtualizacao } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  try {
    if (!(await setSecret('github_token', ''))) return { erro: 'token_nao_removido' }
    return { ok: true, vista: await montarVista() }
  } catch {
    return { erro: 'token_nao_removido' }
  }
}


export async function dispararAtualizacao(): Promise<{ ok: true } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }

  const vista = await montarVista()
  if (vista.estado === 'sem_licenca') return { erro: 'sem_licenca' }
  if (vista.estado === 'faltando_config') return { erro: 'faltando_config' }
  
  
  if (vista.estado !== 'ha_versao_nova' || !vista.versaoMaisNova) return { erro: 'sem_alvo' }
  
  if (estaEmAndamento(vista.andamento)) return { erro: 'ja_rodando' }

  const alvo = vista.versaoMaisNova
  void aplicarAtualizacao(alvo).catch(() => {})
  return { ok: true }
}


export async function dispararReversao(): Promise<{ ok: true } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }

  const vista = await montarVista()
  if (!vista.podeReverter) return { erro: 'nada_a_reverter' }
  if (estaEmAndamento(vista.andamento)) return { erro: 'ja_rodando' }

  void reverterAtualizacao().catch(() => {})
  return { ok: true }
}


export async function lerAndamento(): Promise<VistaAtualizacao | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  return montarVista()
}
