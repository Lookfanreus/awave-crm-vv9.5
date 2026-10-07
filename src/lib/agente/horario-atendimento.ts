

































export type Faixa = { dia: number; inicio: string; fim: string }


export type ConfigHorario = {
  fuso: string
  faixas: Faixa[]
  
  feriados: string[]
}


export type Volta = {
  quando: 'hoje' | 'amanha' | 'outro_dia'
  
  diaSemana: number
  
  hora: string
}

export type Atendimento =
  | { estado: 'sem_horario' }
  | { estado: 'dentro' }
  | { estado: 'fora'; volta: Volta | null }


export const FUSOS: readonly string[] = [
  'America/Araguaina',
  'America/Bahia',
  'America/Belem',
  'America/Boa_Vista',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Eirunepe',
  'America/Fortaleza',
  'America/Maceio',
  'America/Manaus',
  'America/Noronha',
  'America/Porto_Velho',
  'America/Recife',
  'America/Rio_Branco',
  'America/Santarem',
  'America/Sao_Paulo',
]


export const FUSO_PADRAO = 'America/Sao_Paulo'


const DIAS_A_FRENTE = 8

export function ehFuso(v: unknown): v is string {
  return typeof v === 'string' && FUSOS.includes(v)
}


export function minutosDe(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string') return null
  const m = /^([0-9]{2}):([0-9]{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (min > 59) return null
  if (h === 24) return min === 0 ? 1440 : null
  if (h > 23) return null
  return h * 60 + min
}


export function horaDe(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function ehData(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(v.trim())
  if (!m) return false
  const mes = Number(m[2])
  const dia = Number(m[3])
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31
}


export function normalizarConfig(bruto: unknown): ConfigHorario | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as { fuso?: unknown; faixas?: unknown; feriados?: unknown }
  const fuso = ehFuso(o.fuso) ? o.fuso : null
  if (!fuso) return null
  const faixas: Faixa[] = []
  if (Array.isArray(o.faixas)) {
    for (const f of o.faixas) {
      if (!f || typeof f !== 'object') continue
      const c = f as { dia?: unknown; inicio?: unknown; fim?: unknown }
      const dia = typeof c.dia === 'number' && Number.isInteger(c.dia) && c.dia >= 0 && c.dia <= 6 ? c.dia : null
      const i = minutosDe(c.inicio)
      const fim = minutosDe(c.fim)
      if (dia === null || i === null || fim === null) continue
      
      if (i === fim || i === 1440) continue
      faixas.push({ dia, inicio: horaDe(i), fim: horaDe(fim) })
    }
  }
  
  
  
  if (faixas.length === 0) return null
  const feriados = Array.isArray(o.feriados)
    ? [...new Set(o.feriados.filter(ehData).map((d) => (d as string).trim()))].sort()
    : []
  return { fuso, faixas, feriados }
}


export function relogioLocal(
  fuso: string,
  agoraMs: number,
): { ano: number; mes: number; dia: number; diaSemana: number; minutos: number } | null {
  let partes: Intl.DateTimeFormatPart[]
  try {
    partes = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      
      
      hourCycle: 'h23',
    }).formatToParts(new Date(agoraMs))
  } catch {
    return null
  }
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value])) as Record<string, string>
  const ano = Number(p.year)
  const mes = Number(p.month)
  const dia = Number(p.day)
  const hora = Number(p.hour)
  const min = Number(p.minute)
  if (![ano, mes, dia, hora, min].every(Number.isFinite)) return null
  return { ano, mes, dia, diaSemana: diaDaSemana(ano, mes, dia), minutos: hora * 60 + min }
}


function diaDaSemana(ano: number, mes: number, dia: number): number {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
}


function dataMais(ano: number, mes: number, dia: number, n: number): { iso: string; diaSemana: number } {
  const d = new Date(Date.UTC(ano, mes - 1, dia + n))
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  return { iso, diaSemana: d.getUTCDay() }
}


function faixasDoDia(config: ConfigHorario, diaSemana: number): Array<{ inicio: number; fim: number }> {
  return config.faixas
    .filter((f) => f.dia === diaSemana)
    .map((f) => ({ inicio: minutosDe(f.inicio)!, fim: minutosDe(f.fim)! }))
    .sort((a, b) => a.inicio - b.inicio)
}


export function avaliarAtendimento(config: ConfigHorario | null, agoraMs: number): Atendimento {
  if (!config) return { estado: 'sem_horario' }
  const agora = relogioLocal(config.fuso, agoraMs)
  
  
  
  if (!agora) return { estado: 'sem_horario' }

  const hoje = dataMais(agora.ano, agora.mes, agora.dia, 0)
  const ontem = dataMais(agora.ano, agora.mes, agora.dia, -1)
  const feriado = new Set(config.feriados)

  if (!feriado.has(hoje.iso)) {
    for (const f of faixasDoDia(config, hoje.diaSemana)) {
      const dentro =
        f.fim > f.inicio ? agora.minutos >= f.inicio && agora.minutos < f.fim : agora.minutos >= f.inicio
      if (dentro) return { estado: 'dentro' }
    }
  }
  
  if (!feriado.has(ontem.iso)) {
    for (const f of faixasDoDia(config, ontem.diaSemana)) {
      if (f.fim < f.inicio && agora.minutos < f.fim) return { estado: 'dentro' }
    }
  }

  return { estado: 'fora', volta: proximaAbertura(config, agora, feriado) }
}

function proximaAbertura(
  config: ConfigHorario,
  agora: { ano: number; mes: number; dia: number; minutos: number },
  feriado: Set<string>,
): Volta | null {
  for (let d = 0; d < DIAS_A_FRENTE; d++) {
    const data = dataMais(agora.ano, agora.mes, agora.dia, d)
    if (feriado.has(data.iso)) continue
    for (const f of faixasDoDia(config, data.diaSemana)) {
      
      if (d === 0 && f.inicio <= agora.minutos) continue
      return {
        quando: d === 0 ? 'hoje' : d === 1 ? 'amanha' : 'outro_dia',
        diaSemana: data.diaSemana,
        hora: horaDe(f.inicio),
      }
    }
  }
  return null
}
