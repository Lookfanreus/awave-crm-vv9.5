













import 'server-only'
import { admin } from '@/server/supabase'
import { detalheSeguro } from '@/lib/sanitizar-erro'
import type { Orcamento } from '@/lib/orcamento-tick'
import { BUCKET } from '@/server/canais/midia-tick'
import type { MidiaLinha } from '@/server/canais/leitura'


export const LOTE_DE_REMOCAO = 100


export const LOTE_DA_VARREDURA = 100


export const LOTES_POR_PREFIXO = 5


export const TETO_DE_OBJETOS_POR_CANAL = 1_000


const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LinhaComMidia = { id: string; midia: MidiaLinha | null }


function caminhoDoInquilino(ws: string, linha: LinhaComMidia): string | null {
  const midia = linha.midia
  if (!midia || midia.status !== 'ok') return null
  const caminho = midia.caminho
  if (typeof caminho !== 'string' || !caminho.startsWith(`${ws}/`)) return null
  return caminho
}


async function removerEmLotes(caminhos: string[]): Promise<number> {
  let apagados = 0
  for (let i = 0; i < caminhos.length; i += LOTE_DE_REMOCAO) {
    const lote = caminhos.slice(i, i + LOTE_DE_REMOCAO)
    const { error } = await admin().storage.from(BUCKET).remove(lote)
    if (error) {
      console.warn('[canais/midia-bucket] lote nao removido:', detalheSeguro(error))
      continue
    }
    apagados += lote.length
  }
  return apagados
}


export async function apagarObjetosDoCanal(ws: string, canalId: string): Promise<number> {
  try {
    const { data, error } = await admin()
      .from('mensagens')
      .select('id, midia, conversas!inner(canal_id)')
      .eq('workspace_id', ws)
      .eq('conversas.canal_id', canalId)
      .limit(TETO_DE_OBJETOS_POR_CANAL)
    if (error) throw error

    const caminhos: string[] = []
    for (const linha of (data ?? []) as LinhaComMidia[]) {
      const caminho = caminhoDoInquilino(ws, linha)
      if (caminho) caminhos.push(caminho)
    }
    if (caminhos.length === 0) return 0
    return await removerEmLotes(caminhos)
  } catch (err) {
    
    
    console.warn('[canais/midia-bucket] objetos do canal ficaram orfaos:', detalheSeguro(err))
    return 0
  }
}


async function prefixosParaVarrer(): Promise<string[]> {
  const { data } = await admin()
    .storage.from(BUCKET)
    .list('', { limit: LOTE_DA_VARREDURA * LOTES_POR_PREFIXO })
  return (data ?? []).map((e) => e.name).filter((n) => typeof n === 'string' && RE_UUID.test(n))
}

function idadeMs(criadoEm: unknown, agoraMs: number): number | null {
  if (typeof criadoEm !== 'string') return null
  const t = Date.parse(criadoEm)
  if (!Number.isFinite(t)) return null
  return agoraMs - t
}


export async function apagarOrfaosDoBucket(
  agoraMs: number,
  gracaMs: number,
  orcamento: Orcamento,
): Promise<number> {
  let apagados = 0
  try {
    for (const ws of await prefixosParaVarrer()) {
      
      
      
      
      
      
      
      try {
        let offset = 0
        for (let lote = 0; lote < LOTES_POR_PREFIXO; lote++) {
          if (!orcamento.cabe('expurgo')) return apagados

          const { data } = await admin()
            .storage.from(BUCKET)
            .list(ws, { limit: LOTE_DA_VARREDURA, offset })
          const objetos = data ?? []
          if (objetos.length === 0) break

          
          
          
          
          const maduros = objetos.filter((o) => {
            if (!RE_UUID.test(o.name)) return false
            const idade = idadeMs((o as { created_at?: unknown }).created_at, agoraMs)
            return idade !== null && idade >= gracaMs
          })

          let apagadosNoLote = 0
          if (maduros.length > 0) {
            const nomes = maduros.map((o) => o.name)
            const { data: linhas, error } = await admin()
              .from('mensagens')
              .select('id, midia')
              .eq('workspace_id', ws)
              .in('id', nomes)
            
            
            if (error) throw error

            const reivindicados = new Set<string>()
            for (const linha of (linhas ?? []) as LinhaComMidia[]) {
              const caminho = caminhoDoInquilino(ws, linha)
              if (caminho) reivindicados.add(caminho)
            }
            const orfaos = maduros
              .map((o) => `${ws}/${o.name}`)
              .filter((c) => !reivindicados.has(c))
            if (orfaos.length > 0) apagadosNoLote = await removerEmLotes(orfaos)
          }

          apagados += apagadosNoLote
          offset += objetos.length - apagadosNoLote
          if (objetos.length < LOTE_DA_VARREDURA) break
        }
      } catch (err) {
        console.warn('[canais/midia-bucket] prefixo pulado na varredura:', detalheSeguro(err))
        continue
      }
    }
  } catch (err) {
    
    
    
    console.warn('[canais/midia-bucket] varredura de orfaos interrompida:', detalheSeguro(err))
  }
  return apagados
}
