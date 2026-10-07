


export const CSV_ESQUEMA_REVISAO = '9304ae2ff5c74801b075415901efbda8' as const

const BOM = '﻿'


export function detectarSeparador(texto: string): ';' | ',' {
  const linha = texto.replace(BOM, '').split(/\r?\n/)[0] ?? ''
  let aspas = false, pv = 0, vg = 0
  for (const c of linha) {
    if (c === '"') aspas = !aspas
    else if (!aspas && c === ';') pv++
    else if (!aspas && c === ',') vg++
  }
  return vg > pv ? ',' : ';'
}


export function parseCsv(texto: string): string[][] {
  const sep = detectarSeparador(texto)
  const src = texto.replace(BOM, '')
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (aspas) {
      if (c === '"') {
        if (src[i + 1] === '"') { campo += '"'; i++ }   
        else aspas = false
      } else campo += c
      continue
    }
    if (c === '"') { aspas = true; continue }
    if (c === sep) { linha.push(campo); campo = ''; continue }
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue }
    if (c === '\r') continue                              
    campo += c
  }
  if (campo !== '' || linha.length > 0) { linha.push(campo); linhas.push(linha) }
  return linhas
}


export function paraCsv(linhas: string[][]): string {
  const escapar = (v: string) =>
    /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  return BOM + linhas.map((l) => l.map(escapar).join(';')).join('\n')
}
