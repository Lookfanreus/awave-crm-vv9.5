










import {
  FUSOS,
  minutosDe,
  type Atendimento,
  type ConfigHorario,
  type Faixa,
} from '@/lib/agente/horario-atendimento'


export type LinhaDoDia = {
  
  dia: number
  aberto: boolean
  
  inicio: string
  fim: string
}

export const NOME_DOS_DIAS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const


export function linhasDoFormulario(config: ConfigHorario | null): LinhaDoDia[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dia) => {
    const f = config?.faixas.find((x) => x.dia === dia)
    return f
      ? { dia, aberto: true, inicio: f.inicio, fim: f.fim }
      : { dia, aberto: false, inicio: '09:00', fim: '18:00' }
  })
}

export type ResultadoDeFaixas = { faixas: Faixa[] } | { erro: string }


export function faixasDoFormulario(linhas: LinhaDoDia[]): ResultadoDeFaixas {
  const faixas: Faixa[] = []
  for (const l of linhas) {
    if (!l.aberto) continue
    const nome = NOME_DOS_DIAS[l.dia] ?? 'Dia'
    const i = minutosDe(l.inicio)
    const f = minutosDe(l.fim)
    if (i === null || f === null) {
      return { erro: `${nome}: preencha o horário de abertura e o de fechamento no formato 24 horas.` }
    }
    if (i === 1440) return { erro: `${nome}: a abertura não pode ser às 24:00.` }
    if (i === f) {
      return { erro: `${nome}: a abertura e o fechamento estão no mesmo horário. Se a empresa atende o dia inteiro, use 00:00 e 24:00.` }
    }
    faixas.push({ dia: l.dia, inicio: l.inicio, fim: l.fim })
  }
  return { faixas }
}

export type ResultadoDeFeriados = { feriados: string[] } | { erro: string }


function dataReal(ano: number, mes: number, dia: number): boolean {
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}


export function feriadosDoTexto(texto: string): ResultadoDeFeriados {
  const feriados: string[] = []
  for (const bruta of texto.split(/[\n,;]/)) {
    const linha = bruta.trim()
    if (!linha) continue
    const br = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/.exec(linha)
    const iso = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(linha)
    const [ano, mes, dia] = br
      ? [Number(br[3]), Number(br[2]), Number(br[1])]
      : iso
        ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
        : [0, 0, 0]
    if (!ano || !dataReal(ano, mes, dia)) {
      return { erro: `Não entendi a data «${linha}». Escreva uma por linha, no formato 25/12/2026.` }
    }
    feriados.push(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
  }
  return { feriados: [...new Set(feriados)].sort() }
}


export function textoDosFeriados(feriados: string[]): string {
  return feriados
    .map((f) => {
      const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(f)
      return m ? `${m[3]}/${m[2]}/${m[1]}` : f
    })
    .join('\n')
}


export const TETO_FERIADOS = 60

export function fusoValido(v: string): boolean {
  return FUSOS.includes(v)
}


export function fraseDoEstado(a: Atendimento): string {
  if (a.estado === 'sem_horario') {
    return 'Sem horário configurado. O assistente responde a qualquer hora, que é como ele funciona hoje.'
  }
  if (a.estado === 'dentro') {
    return 'Agora é dentro do horário de atendimento.'
  }
  return 'Agora é fora do horário de atendimento. O assistente continua respondendo — o que muda é que ele passa a dizer a partir de quando alguém do time responde.'
}
