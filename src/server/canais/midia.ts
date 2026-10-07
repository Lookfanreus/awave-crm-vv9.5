



















import 'server-only'
import { request as requestHttps } from 'node:https'
import { lookup as lookupDns } from 'node:dns/promises'
import type { RefExternaMidia } from '@/server/canais/types'


export type UrlDeMidiaValidada = string & { readonly __validada: unique symbol }

export const TIMEOUT_MS = 20_000
export const TETO_BYTES = 20 * 1024 * 1024

export const MAX_SALTOS = 3


export function ehHostLiteralDeIp(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[')
}


export function ehIpPrivado(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase()
    if (v6 === '::' || v6 === '::1') return true
    if (/^f[cd]/.test(v6)) return true 
    if (/^fe[89ab]/.test(v6)) return true 
    if (v6.startsWith('::ffff:')) return ehIpPrivado(v6.slice(7)) 
    return false
  }
  const partes = ip.split('.')
  
  
  
  if (partes.length !== 4 || partes.some((p) => !/^\d{1,3}$/.test(p))) return true
  const o = partes.map(Number)
  if (o.some((n) => n > 255)) return true
  if (o[0] === 10 || o[0] === 127 || o[0] === 0) return true
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true
  if (o[0] === 192 && o[1] === 168) return true
  if (o[0] === 169 && o[1] === 254) return true
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true
  if (o[0] >= 224) return true
  return false
}


export function validarUrlDeMidia(
  ref: RefExternaMidia,
  serverUrl: string,
): UrlDeMidiaValidada | null {
  return revalidarSalto(ref.valor, serverUrl)
}


export function revalidarSalto(bruta: string, serverUrl: string): UrlDeMidiaValidada | null {
  let u: URL, base: URL
  try {
    u = new URL(bruta)
    base = new URL(serverUrl)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (ehHostLiteralDeIp(u.hostname) || ehHostLiteralDeIp(base.hostname)) return null
  if (u.hostname !== base.hostname) return null
  return bruta as UrlDeMidiaValidada
}


export interface RespostaCrua {
  status: number
  location: string | null
  
  tamanho: number | null
  corpo: AsyncIterable<Uint8Array>
  cancelar: () => void
}

export interface DepsMidia {
  resolverIp?: (hostname: string) => Promise<string>
  abrir?: (url: string, ip: string, sinal: AbortSignal) => Promise<RespostaCrua>
}

async function resolverIpReal(hostname: string): Promise<string> {
  const { address } = await lookupDns(hostname)
  return address
}


export type Requisitador = typeof requestHttps


function abrirComRequest(
  url: string,
  ip: string,
  sinal: AbortSignal,
  request: Requisitador,
): Promise<RespostaCrua> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        signal: sinal,
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        lookup: (_hostname, opts, cb) => {
          const familia = ip.includes(':') ? 6 : 4
          if (opts?.all) {
            cb(null, [{ address: ip, family: familia }])
            return
          }
          cb(null, ip, familia)
        },
      },
      (res) => {
        const declarado = Number(res.headers['content-length'])
        resolve({
          status: res.statusCode ?? 0,
          location: (res.headers.location as string | undefined) ?? null,
          
          
          
          tamanho: Number.isFinite(declarado) && declarado > 0 ? declarado : null,
          corpo: res,
          cancelar: () => res.destroy(),
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

function abrirReal(url: string, ip: string, sinal: AbortSignal): Promise<RespostaCrua> {
  return abrirComRequest(url, ip, sinal, requestHttps)
}


export const abrirParaTeste = abrirComRequest

export type ResultadoDownload =
  | { ok: true; bytes: Uint8Array; mime: string | null }
  
  | { ok: false; motivo: 'rede' | 'http' | 'grande' | 'sem_cota' | 'destino_recusado' }


export async function baixarMidia(
  url: UrlDeMidiaValidada,
  serverUrl: string,
  deps: DepsMidia = {},
  cotaRestante: number = Number.POSITIVE_INFINITY,
): Promise<ResultadoDownload> {
  const resolverIp = deps.resolverIp ?? resolverIpReal
  const abrir = deps.abrir ?? abrirReal
  
  
  
  
  
  
  
  
  
  
  
  
  
  const sinal = AbortSignal.timeout(TIMEOUT_MS)

  let atual: string = url
  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    
    
    
    const validada = revalidarSalto(atual, serverUrl)
    if (!validada) return { ok: false, motivo: 'destino_recusado' }

    let ip: string
    try {
      ip = await resolverIp(new URL(validada).hostname)
    } catch {
      return { ok: false, motivo: 'rede' }
    }
    if (ehIpPrivado(ip)) return { ok: false, motivo: 'destino_recusado' }

    let res: RespostaCrua
    try {
      res = await abrir(validada, ip, sinal)
    } catch {
      return { ok: false, motivo: 'rede' }
    }

    if (res.status >= 300 && res.status < 400) {
      res.cancelar()
      if (!res.location) return { ok: false, motivo: 'http' }
      
      atual = new URL(res.location, validada).toString()
      continue
    }
    if (res.status !== 200) {
      res.cancelar()
      return { ok: false, motivo: 'http' }
    }

    
    
    
    
    
    
    
    
    
    
    const declarado = res.tamanho
    if (declarado !== null) {
      if (declarado > TETO_BYTES) {
        res.cancelar()
        return { ok: false, motivo: 'grande' }
      }
      if (declarado > cotaRestante) {
        res.cancelar()
        return { ok: false, motivo: 'sem_cota' }
      }
    }

    const pedacos: Uint8Array[] = []
    let total = 0
    try {
      for await (const p of res.corpo) {
        total += p.byteLength
        if (total > TETO_BYTES) {
          
          
          res.cancelar()
          return { ok: false, motivo: 'grande' }
        }
        
        
        if (total > cotaRestante) {
          res.cancelar()
          return { ok: false, motivo: 'sem_cota' }
        }
        pedacos.push(p)
      }
    } catch {
      return { ok: false, motivo: 'rede' }
    }

    const bytes = new Uint8Array(total)
    let off = 0
    for (const p of pedacos) {
      bytes.set(p, off)
      off += p.byteLength
    }
    
    
    return { ok: true, bytes, mime: null }
  }
  
  return { ok: false, motivo: 'destino_recusado' }
}
