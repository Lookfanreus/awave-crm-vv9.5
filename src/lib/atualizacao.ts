


export function partesDaVersao(ref: string | null | undefined): [number, number, number] | null {
  const m = String(ref ?? '').trim().match(/^v(\d+)\.(\d+)\.(\d+)$/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}


export function comparaVersoes(a: string | null | undefined, b: string | null | undefined): number | null {
  const pa = partesDaVersao(a)
  const pb = partesDaVersao(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1
  }
  return 0
}


export function temVersaoNova(atual: string | null, maisNova: string | null): boolean {
  return comparaVersoes(maisNova, atual) === 1
}


export function normalizarRepo(entrada: string): { ok: true; repo: string } | { erro: string } {
  let s = String(entrada ?? '').trim()
  if (!s) return { erro: 'repo_vazio' }

  
  
  s = s.replace(/^https?:\/\/(www\.)?github\.com\//i, '')
  s = s.replace(/\.git$/i, '').replace(/\/+$/, '')

  const partes = s.split('/')
  if (partes.length !== 2) return { erro: 'repo_formato' }
  const [dono, nome] = partes
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(dono)) return { erro: 'repo_dono' }
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(nome)) return { erro: 'repo_nome' }
  return { ok: true, repo: `${dono}/${nome}` }
}


export function pareceTokenGitHub(entrada: string): boolean {
  const t = String(entrada ?? '').trim()
  
  return /^(github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,})$/.test(t)
}


export const LINK_CRIAR_TOKEN = 'https://github.com/settings/personal-access-tokens/new'


export type EstadoAtualizacao =
  | 'sem_licenca'        
  | 'faltando_config'    
  | 'em_dia'
  | 'ha_versao_nova'
  | 'indeterminado'      

export function estadoDoCard(e: {
  
  temChave: boolean
  licencaAtiva: boolean
  temToken: boolean
  temRepo: boolean
  versaoAtual: string | null
  versaoMaisNova: string | null
}): EstadoAtualizacao {
  if (!e.temChave || !e.licencaAtiva) return 'sem_licenca'
  if (!e.temToken || !e.temRepo) return 'faltando_config'
  const cmp = comparaVersoes(e.versaoMaisNova, e.versaoAtual)
  if (cmp === null) return 'indeterminado'
  return cmp === 1 ? 'ha_versao_nova' : 'em_dia'
}
