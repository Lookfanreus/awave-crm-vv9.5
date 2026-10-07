import 'server-only'
import manifesto from '@/server/awave-manifest.json'
import { getSecret } from '@/server/secrets'
import { ehCaminhoCustom } from '@/lib/custom-zone'
import {
  compararManifesto,
  DESCONHECIDO,
  type RelatorioDivergencia,
} from '@/lib/manifesto-diff'



export type DepsDeteccao = {
  lerRepo?: () => Promise<string | null>
  lerToken?: () => Promise<string | null>
  lerCanonico?: () => Record<string, string> | null
  buscar?: typeof fetch
}

type ArvoreGitHub = {
  tree?: Array<{ path?: string; type?: string; sha?: string }>
  truncated?: boolean
}

async function pedirGitHub(
  buscar: typeof fetch,
  url: string,
  token: string,
): Promise<unknown | null> {
  const res = await buscar(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      
      'User-Agent': 'awave-crm',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  return res.ok ? await res.json() : null
}

export async function detectarDivergencia(
  deps: DepsDeteccao = {},
): Promise<RelatorioDivergencia> {
  const lerRepo = deps.lerRepo ?? (() => getSecret('update_repo'))
  const lerToken = deps.lerToken ?? (() => getSecret('github_token'))
  const lerCanonico =
    deps.lerCanonico ??
    (() => (manifesto as { files?: Record<string, string> }).files ?? null)
  const buscar = deps.buscar ?? fetch

  try {
    const canonico = lerCanonico()
    
    
    if (!canonico) return DESCONHECIDO

    const [repo, token] = await Promise.all([lerRepo(), lerToken()])
    if (!repo || !token) return DESCONHECIDO

    const [dono, nome] = repo.split('/')
    if (!dono || !nome) return DESCONHECIDO

    const base = `https://api.github.com/repos/${dono}/${nome}`
    const info = (await pedirGitHub(buscar, base, token)) as {
      default_branch?: string
    } | null
    if (!info?.default_branch) return DESCONHECIDO

    const arvore = (await pedirGitHub(
      buscar,
      `${base}/git/trees/${info.default_branch}?recursive=1`,
      token,
    )) as ArvoreGitHub | null
    if (!arvore?.tree) return DESCONHECIDO

    
    
    if (arvore.truncated) return DESCONHECIDO

    const real: Record<string, string> = {}
    for (const e of arvore.tree) {
      if (e.type !== 'blob') continue
      if (typeof e.path !== 'string' || typeof e.sha !== 'string') continue
      
      
      
      if (ehCaminhoCustom(e.path)) continue
      real[e.path] = e.sha
    }

    return compararManifesto(canonico, real)
  } catch {
    return DESCONHECIDO
  }
}
