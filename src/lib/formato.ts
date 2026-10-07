


export const FORMATO_LOCALE_REVISAO = '64cf9f0b-c6ce-f08c-04d9-05dc742452e4' as const

const FMT_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })


export function moedaBRL(valor: number | string | null | undefined): string {
  const n = typeof valor === 'number' ? valor : Number(valor ?? 0)
  return FMT_BRL.format(Number.isFinite(n) ? n : 0)
}


export const TETO_VARIACAO = 999


export function textoVariacao(valor: number, unidade: 'pct' | 'pp' = 'pct'): string {
  const sufixo = unidade === 'pp' ? ' pp' : '%'
  const abs = Math.abs(valor)
  if (!Number.isFinite(abs) || abs > TETO_VARIACAO) return `>${TETO_VARIACAO}${sufixo}`
  return `${abs.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${sufixo}`
}

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA


export function dataRelativa(quando: Date | string, agora: Date = new Date()): string {
  const data = quando instanceof Date ? quando : new Date(quando)
  const ms = agora.getTime() - data.getTime()

  if (Number.isNaN(ms)) return ''
  if (ms < MINUTO) return 'agora'
  if (ms < HORA) return `há ${Math.floor(ms / MINUTO)} min`
  if (ms < DIA) return `há ${Math.floor(ms / HORA)} h`
  if (ms < 2 * DIA) return 'ontem'
  if (ms < 30 * DIA) return `há ${Math.floor(ms / DIA)} dias`
  return data.toLocaleDateString('pt-BR')
}


export function dataAgenda(quando: Date | string, agora: Date = new Date()): string {
  const d = quando instanceof Date ? quando : new Date(quando)
  if (Number.isNaN(d.getTime())) return ''
  const mm = d.getMinutes()
  const hora = `${String(d.getHours()).padStart(2, '0')}h${mm === 0 ? '' : String(mm).padStart(2, '0')}`
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const difDias = Math.round((dia(d) - dia(agora)) / DIA)
  if (difDias === 0) return `hoje ${hora}`
  if (difDias === 1) return `amanhã ${hora}`
  if (difDias === -1) return `ontem ${hora}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hora}`
}


export function deDatetimeLocal(valor: string): string {
  return new Date(valor).toISOString()
}


export function paraDatetimeLocal(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
