
function derivar(nome: string, fallback: string, usados: string[]): string {
  const base = nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || fallback
  if (!usados.includes(base)) return base
  let i = 2
  while (usados.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}


export function slugTipo(nome: string, usados: string[] = []): string {
  return derivar(nome, 'tipo', usados)
}


export function slugCampo(rotulo: string, usados: string[] = []): string {
  return derivar(rotulo, 'campo', usados)
}


export function slugAutomacao(nome: string): string {
  return derivar(nome, 'automacao', [])
}
