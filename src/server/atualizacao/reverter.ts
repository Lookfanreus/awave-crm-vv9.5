import 'server-only'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getSecret } from '@/server/secrets'
import { lerConfig } from '@/server/configuracoes'
import { mensagemSegura } from '@/lib/sanitizar-erro'
import { refDaRelease } from '@/server/versao'
import { git, urlComToken } from '@/server/atualizacao/git'
import { gravarEstado, CHAVE_ULTIMO_COMMIT } from '@/server/atualizacao/aplicar'
import { avisarOPainel } from '@/server/atualizacao/gatilho'



export type DepsReverter = {
  reverterCommit?: (sha: string) => Promise<void>
  lerSha?: () => Promise<string | null>
  agoraIso?: () => string
}

async function reverterCommitPadrao(sha: string): Promise<void> {
  const [token, repo] = await Promise.all([
    getSecret('github_token'),
    getSecret('update_repo'),
  ])
  if (!token || !repo) {
    throw new Error('Configure o repositório e o token do GitHub antes de reverter.')
  }
  const dirClone = await mkdtemp(join(tmpdir(), 'awave-crm-revert-'))
  try {
    
    
    await git.clonarCompleto(urlComToken(repo, token), dirClone)
    await git.reverter(dirClone, sha)
    await git.empurrar(dirClone)
  } finally {
    await rm(dirClone, { recursive: true, force: true }).catch(() => {})
  }
}

export async function reverterAtualizacao(deps: DepsReverter = {}): Promise<void> {
  const agoraIso = deps.agoraIso ?? (() => new Date().toISOString())
  const reverterCommit = deps.reverterCommit ?? reverterCommitPadrao
  const lerSha = deps.lerSha ?? (() => lerConfig(CHAVE_ULTIMO_COMMIT))

  
  
  
  const alvo = refDaRelease() ?? 'anterior'

  try {
    const sha = await lerSha()
    if (!sha) {
      
      
      throw new Error(
        'Não sei com segurança qual atualização reverter — reverta manualmente (veja o DEPLOY.md).',
      )
    }
    await gravarEstado({ fase: 'publicando', alvo, em: agoraIso() })
    await reverterCommit(sha)
    
    
    
    await avisarOPainel(agoraIso)
    await gravarEstado({ fase: 'aguardando_rebuild', alvo, em: agoraIso() })
  } catch (erro) {
    await gravarEstado({
      fase: 'erro',
      alvo,
      em: agoraIso(),
      erro: mensagemSegura(erro),
    })
    throw erro
  }
}
