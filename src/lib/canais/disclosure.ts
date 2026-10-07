







export const REPETIR_APOS_DIAS = 30


export function textoDoDisclosure(empresa: string): string {
  const nome = (empresa ?? '').trim()
  const de = nome ? `da ${nome}` : 'da empresa'
  return `Oi! Sou o assistente virtual (IA) ${de}. Se preferir, escreva "falar com atendente": eu paro de responder e alguém do time segue por aqui.`
}


export function linhaDoDisclosure(): string {
  return textoDoDisclosure('')
}


const DELIMITADOR = /["'(),.:%_\\]/


export const PREFIXO_BUSCAVEL_DO_DISCLOSURE = (() => {
  const linha = linhaDoDisclosure()
  const corte = linha.search(DELIMITADOR)
  return corte === -1 ? linha : linha.slice(0, corte)
})()


export function carregaDisclosure(texto: string | null | undefined): boolean {
  return (texto ?? '').trimStart().startsWith(linhaDoDisclosure())
}


export function precisaDisclosure(input: {
  
  avisosEntregues: number
  
  ultimoAvisoEm: string | null
  agora: string
  repetirAposDias?: number
}): boolean {
  if (input.avisosEntregues <= 0) return true
  if (!input.ultimoAvisoEm) return true
  const t = Date.parse(input.ultimoAvisoEm)
  const agora = Date.parse(input.agora)
  
  
  if (!Number.isFinite(t) || !Number.isFinite(agora)) return false
  const dias = (agora - t) / 86_400_000
  return dias >= (input.repetirAposDias ?? REPETIR_APOS_DIAS)
}


export function aplicarDisclosure(bolhas: string[], linha: string | null): string[] {
  if (!linha || !linha.trim()) return bolhas
  if (!bolhas.length) return bolhas
  const primeira = bolhas[0] ?? ''
  const juntas = `${linha.trim()}\n\n${primeira}`.trim()
  return [juntas, ...bolhas.slice(1)]
}
