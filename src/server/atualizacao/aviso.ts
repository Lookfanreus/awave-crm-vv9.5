import 'server-only'
import { getSecret } from '@/server/secrets'
import { readLicenseCache } from '@/server/license/cache'
import { donoDoDeploy } from '@/server/auth/dono-deploy'
import { refDaRelease } from '@/server/versao'
import { estadoDoCard } from '@/lib/atualizacao'
import { ehODono } from '@/lib/dono-deploy'
import { detalheSeguro } from '@/lib/sanitizar-erro'




const TTL_MS = 5 * 60 * 1000


let memo: { ate: number; valor: Promise<Deploy> } | null = null

type Deploy = { dono: string | null; haVersaoNova: boolean }


export function invalidarMemoAviso(): void {
  memo = null
}

async function lerDeploy(): Promise<Deploy> {
  try {
    const [dono, cache, chave, token, repo] = await Promise.all([
      donoDoDeploy(),
      readLicenseCache(),
      getSecret('license_key'),
      getSecret('github_token'),
      getSecret('update_repo'),
    ])
    const estado = estadoDoCard({
      temChave: !!chave?.trim(),
      licencaAtiva: cache?.hub_status === 'active' && cache?.entitled === true,
      temToken: !!token,
      temRepo: !!repo,
      versaoAtual: refDaRelease(),
      versaoMaisNova: (cache as { latest_version?: string } | null)?.latest_version ?? null,
    })
    return { dono, haVersaoNova: estado === 'ha_versao_nova' }
  } catch (erro) {
    
    
    
    console.error('[atualizacao] aviso do rail: leitura falhou, sem ponto', detalheSeguro(erro))
    return { dono: null, haVersaoNova: false }
  }
}


export async function mostrarAvisoDeAtualizacao(
  userId: string | null | undefined,
  agora: number = Date.now(),
): Promise<boolean> {
  if (!userId) return false
  if (!memo || agora >= memo.ate) memo = { ate: agora + TTL_MS, valor: lerDeploy() }
  const { dono, haVersaoNova } = await memo.valor
  return haVersaoNova && ehODono(userId, dono)
}
