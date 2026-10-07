import 'server-only'
import { mkdtemp, cp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { getSecret } from '@/server/secrets'
import { lerConfig, gravarConfig } from '@/server/configuracoes'
import { validarEntradasDoZip } from '@/lib/zip-seguro'
import { planejarPublicacao, ZONA } from '@/lib/custom-zone'
import { mensagemSegura } from '@/lib/sanitizar-erro'
import { precisaDeBackup, type RelatorioDivergencia } from '@/lib/manifesto-diff'
import type { EstadoDaAtualizacao, FaseAtualizacao } from '@/lib/estado-atualizacao'
import { detectarDivergencia } from '@/server/atualizacao/detectar'
import { git, urlComToken } from '@/server/atualizacao/git'
import { avisarOPainel } from '@/server/atualizacao/gatilho'
import { urlDoHub } from '@/server/license/validar'
import { TENTATIVAS, deveRetentar, esperaMs } from '@/lib/retentativa-download'



export const CHAVE_ESTADO = 'update_state'
export const CHAVE_DIVERGENCIA = 'update_divergence'
export const CHAVE_ULTIMO_COMMIT = 'update_last_commit'

export async function gravarEstado(e: EstadoDaAtualizacao): Promise<void> {
  await gravarConfig(CHAVE_ESTADO, JSON.stringify(e))
}

export async function lerEstadoBruto(): Promise<string | null> {
  return lerConfig(CHAVE_ESTADO)
}

export type DepsAplicar = {
  baixarZip?: (alvo: string) => Promise<Buffer>
  extrairZip?: (buf: Buffer) => Promise<string>
  detectar?: () => Promise<RelatorioDivergencia>
  publicar?: (
    dirExtraido: string,
    alvo: string,
    fazerBackup: boolean,
  ) => Promise<{ shaPublicado: string | null }>
  agoraIso?: () => string
  limpar?: (dir: string) => Promise<void>
  buscar?: typeof fetch
  
  esperar?: (ms: number) => Promise<void>
}




async function baixarDoHub(
  buscar: typeof fetch,
  esperar: (ms: number) => Promise<void>,
): Promise<Buffer> {
  
  
  
  const hub = urlDoHub()
  const [chave, instancia] = await Promise.all([
    getSecret('license_key'),
    getSecret('instance_id'),
  ])
  const corpo = JSON.stringify({ license_key: chave, instance_id: instancia })

  
  
  
  
  
  
  
  let ultimoErro: Error | null = null
  
  
  let ultimoRetryAfter: string | null = null
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    if (tentativa > 0) {
      const espera = esperaMs(tentativa, ultimoRetryAfter, Date.now())
      if (espera === null) break
      await esperar(espera)
    }

    let res: Response
    try {
      res = await buscar(`${hub}/api/hub/download-crm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: corpo,
      })
    } catch (e) {
      
      
      ultimoErro = new Error('A conexão caiu durante o download da atualização.')
      ultimoRetryAfter = null
      if (!deveRetentar(null) || tentativa === TENTATIVAS - 1) break
      continue
    }

    if (res.ok) return Buffer.from(await res.arrayBuffer())

    ultimoRetryAfter = res.headers.get('retry-after')
    
    
    if (res.status === 503) {
      throw new Error('Ainda não há uma versão publicada para baixar. Tente mais tarde.')
    }
    ultimoErro = new Error(mensagemDoStatus(res.status))
    
    
    if (!deveRetentar(res.status, ultimoRetryAfter) || tentativa === TENTATIVAS - 1) break
  }

  throw ultimoErro ?? new Error('Não consegui baixar a atualização do Hub.')
}


function mensagemDoStatus(status: number): string {
  if (status === 429) {
    return (
      'O servidor de atualizações recusou por excesso de tentativas. ' +
      'Espere alguns minutos antes de tentar de novo — tentar agora renova o bloqueio.'
    )
  }
  if (status === 401 || status === 403) {
    return 'A licença não autorizou o download. Confira a chave em Configurações.'
  }
  if (status >= 500) {
    return `O servidor de atualizações falhou (HTTP ${status}). Tente de novo em alguns minutos.`
  }
  return `Não consegui baixar a atualização do Hub (HTTP ${status}).`
}


export async function extrairZipPadrao(buf: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'awave-crm-extract-'))
  try {
    const zip = new AdmZip(buf)
    validarEntradasDoZip(zip.getEntries().map((e) => e.entryName))
    zip.extractAllTo(dir, true) 
    
    
    await rm(join(dir, '.git'), { recursive: true, force: true })
    return dir
  } catch (erro) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw erro
  }
}


export async function semearFaltantes(origem: string, destino: string): Promise<void> {
  await cp(origem, destino, { recursive: true, force: false }).catch(
    (e: NodeJS.ErrnoException) => {
      if (e?.code !== 'ENOENT') throw e 
    },
  )
}


export async function publicarArvore(dirClone: string, dirExtraido: string): Promise<void> {
  const plano = planejarPublicacao({
    noClone: await readdir(dirClone),
    noExtraido: await readdir(dirExtraido),
  })
  for (const entrada of plano.apagar) {
    await rm(join(dirClone, entrada), { recursive: true, force: true })
  }
  for (const entrada of plano.copiar) {
    await cp(join(dirExtraido, entrada), join(dirClone, entrada), { recursive: true })
  }
  if (plano.semearDentroDoCustom) {
    await semearFaltantes(join(dirExtraido, ZONA), join(dirClone, ZONA))
  }
}

async function publicarPadrao(
  dirExtraido: string,
  alvo: string,
  fazerBackup: boolean,
): Promise<{ shaPublicado: string | null }> {
  const [token, repo] = await Promise.all([
    getSecret('github_token'),
    getSecret('update_repo'),
  ])
  if (!token || !repo) {
    throw new Error('Configure o repositório e o token do GitHub antes de atualizar.')
  }

  const dirClone = await mkdtemp(join(tmpdir(), 'awave-crm-clone-'))
  try {
    await git.clonarRaso(urlComToken(repo, token), dirClone)

    
    
    
    if (fazerBackup) {
      const branch = `awave-backup/pre-${alvo}`
      if (!(await git.branchRemotoExiste(dirClone, branch))) {
        try {
          await git.empurrarBackup(dirClone, branch)
        } catch {
          throw new Error(
            'Não consegui salvar um backup das suas modificações — nada foi alterado. Tente de novo.',
          )
        }
      }
    }

    await publicarArvore(dirClone, dirExtraido)
    await git.adicionarTudo(dirClone)

    
    
    if (await git.estaLimpo(dirClone)) return { shaPublicado: null }

    await git.commitar(dirClone, `release: ${alvo} (atualização automática)`)
    const sha = await git.shaDoHead(dirClone)
    await git.empurrar(dirClone)
    return { shaPublicado: sha }
  } finally {
    await rm(dirClone, { recursive: true, force: true }).catch(() => {})
  }
}



export async function aplicarAtualizacao(
  alvo: string,
  deps: DepsAplicar = {},
): Promise<void> {
  const agoraIso = deps.agoraIso ?? (() => new Date().toISOString())
  const buscar = deps.buscar ?? fetch
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const baixarZip = deps.baixarZip ?? (() => baixarDoHub(buscar, esperar))
  const extrairZip = deps.extrairZip ?? extrairZipPadrao
  const detectar = deps.detectar ?? detectarDivergencia
  const publicar = deps.publicar ?? publicarPadrao
  const limpar = deps.limpar ?? ((d: string) => rm(d, { recursive: true, force: true }))

  const fase = (f: FaseAtualizacao) => gravarEstado({ fase: f, alvo, em: agoraIso() })

  let dirExtraido: string | null = null
  try {
    
    
    const [repo, token] = await Promise.all([
      getSecret('update_repo'),
      getSecret('github_token'),
    ])
    if (!repo || !token) {
      throw new Error('Configure o repositório e o token do GitHub antes de atualizar.')
    }

    await fase('baixando')
    const buf = await baixarZip(alvo)

    await fase('extraindo')
    dirExtraido = await extrairZip(buf)

    await fase('publicando')
    const divergencia = await detectar()
    
    
    await gravarConfig(CHAVE_DIVERGENCIA, JSON.stringify(divergencia))

    const { shaPublicado } = await publicar(
      dirExtraido,
      alvo,
      precisaDeBackup(divergencia),
    )
    
    
    if (shaPublicado) await gravarConfig(CHAVE_ULTIMO_COMMIT, shaPublicado)

    
    
    
    
    
    
    await avisarOPainel(agoraIso, buscar)

    
    
    
    await fase('aguardando_rebuild')
  } catch (erro) {
    await gravarEstado({
      fase: 'erro',
      alvo,
      em: agoraIso(),
      erro: mensagemSegura(erro),
    })
    throw erro
  } finally {
    if (dirExtraido) await limpar(dirExtraido).catch(() => {})
  }
}
