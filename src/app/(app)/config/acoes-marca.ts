'use server'

import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { excedeLimite } from '@/lib/marca-arquivo'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { admin } from '@/server/supabase'
import { lerConfig, gravarConfig } from '@/server/configuracoes'
import { derivarMarca } from '@/lib/marca-cor'
import { detalheSeguro } from '@/lib/sanitizar-erro'
import { ACCENT_PADRAO, BUCKET, CHAVE_ACCENT, CHAVE_FAVICON, CHAVE_LOGO, CHAVE_NOME, NOME_PADRAO, esquecerMarca, urlPublica } from '@/server/marca'



type Res = { ok: true } | { erro: string; medido?: number }


const TIPOS = ['image/png', 'image/jpeg', 'image/webp'] as const

const EXTENSAO: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

async function guardaDoDono(): Promise<boolean> {
  return ehDonoDoDeploy()
}


async function invalidarLayout(): Promise<void> {
  
  
  
  
  
  esquecerMarca()
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch (err) {
    console.warn('[marca] revalidatePath falhou (não-fatal):', detalheSeguro(err))
  }
}

export async function salvarNomeDaMarca(nome: string): Promise<Res> {
  await exigirEngineLiberado()
  if (!(await guardaDoDono())) return { erro: 'nao_autorizado' }
  const limpo = String(nome ?? '').trim()
  if (!limpo) return { erro: 'nome_vazio' }
  
  if (limpo.length > 40) return { erro: 'nome_longo' }
  try {
    await gravarConfig(CHAVE_NOME, limpo)
    await invalidarLayout()
    return { ok: true }
  } catch { return { erro: 'falha_ao_salvar' } }
}


export async function salvarCorDaMarca(cor: string): Promise<Res> {
  await exigirEngineLiberado()
  if (!(await guardaDoDono())) return { erro: 'nao_autorizado' }
  const r = derivarMarca(String(cor ?? ''))
  if ('erro' in r) {
    return r.erro === 'contraste_baixo'
      ? { erro: 'contraste_baixo', medido: Math.round(r.medido * 10) / 10 }
      : { erro: 'hex_invalido' }
  }
  try {
    await gravarConfig(CHAVE_ACCENT, r.accent)
    await invalidarLayout()
    return { ok: true }
  } catch { return { erro: 'falha_ao_salvar' } }
}


async function subir(qual: 'logo' | 'favicon', arquivo: unknown): Promise<Res> {
  await exigirEngineLiberado()
  if (!(await guardaDoDono())) return { erro: 'nao_autorizado' }

  const f = arquivo as { type?: string; size?: number; arrayBuffer?: () => Promise<ArrayBuffer> }
  if (!f || typeof f.arrayBuffer !== 'function') return { erro: 'sem_arquivo' }
  if (!TIPOS.includes(f.type as (typeof TIPOS)[number])) return { erro: 'tipo_invalido' }
  if (excedeLimite(f.size ?? 0)) return { erro: 'arquivo_grande' }
  if ((f.size ?? 0) === 0) return { erro: 'sem_arquivo' }

  const ext = EXTENSAO[f.type as string]
  
  
  const caminho = `${qual}.${ext}`

  try {
    const bytes = Buffer.from(await f.arrayBuffer!())
    const { error } = await admin().storage.from(BUCKET).upload(caminho, bytes, {
      contentType: f.type,
      upsert: true,
    })
    if (error) throw error

    
    const antigo = (await lerConfig(qual === 'logo' ? CHAVE_LOGO : CHAVE_FAVICON))?.trim()
    if (antigo && antigo !== caminho) {
      await admin().storage.from(BUCKET).remove([antigo]).catch(() => {})
    }

    await gravarConfig(qual === 'logo' ? CHAVE_LOGO : CHAVE_FAVICON, caminho)
    await invalidarLayout()
    return { ok: true }
  } catch (err) {
    console.error('[marca] upload', detalheSeguro(err))
    return { erro: 'falha_ao_enviar' }
  }
}

export async function enviarLogo(dados: FormData): Promise<Res> {
  await exigirEngineLiberado()
  return subir('logo', dados.get('arquivo'))
}

export async function enviarFavicon(dados: FormData): Promise<Res> {
  await exigirEngineLiberado()
  return subir('favicon', dados.get('arquivo'))
}


export async function removerImagem(qual: 'logo' | 'favicon'): Promise<Res> {
  await exigirEngineLiberado()
  if (!(await guardaDoDono())) return { erro: 'nao_autorizado' }
  const chave = qual === 'logo' ? CHAVE_LOGO : CHAVE_FAVICON
  try {
    const atual = (await lerConfig(chave))?.trim()
    if (atual) await admin().storage.from(BUCKET).remove([atual]).catch(() => {})
    await gravarConfig(chave, '')
    await invalidarLayout()
    return { ok: true }
  } catch { return { erro: 'falha_ao_salvar' } }
}


export async function restaurarMarcaPadrao(): Promise<Res> {
  await exigirEngineLiberado()
  if (!(await guardaDoDono())) return { erro: 'nao_autorizado' }
  try {
    await gravarConfig(CHAVE_NOME, NOME_PADRAO)
    await gravarConfig(CHAVE_ACCENT, ACCENT_PADRAO)
    await invalidarLayout()
    return { ok: true }
  } catch { return { erro: 'falha_ao_salvar' } }
}


export async function lerMarcaConfig(): Promise<
  { nome: string; accent: string; logo: string | null; favicon: string | null } | { erro: string }
> {
  if (!(await guardaDoDono())) return { erro: 'nao_autorizado' }
  const [nome, accent, logo, favicon] = await Promise.all([
    lerConfig(CHAVE_NOME), lerConfig(CHAVE_ACCENT), lerConfig(CHAVE_LOGO), lerConfig(CHAVE_FAVICON),
  ])
  return {
    nome: nome?.trim() || NOME_PADRAO,
    accent: accent?.trim() || ACCENT_PADRAO,
    logo: logo?.trim() ? urlPublica(logo.trim()) : null,
    favicon: favicon?.trim() ? urlPublica(favicon.trim()) : null,
  }
}
