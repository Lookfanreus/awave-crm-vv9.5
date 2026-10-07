






import { mensagemSegura } from '@/lib/sanitizar-erro'


const PISO = 8



function textoDe(x: unknown): string {
  try {
    if (x && typeof x === 'object' && 'message' in x) {
      const m = (x as { message: unknown }).message
      if (typeof m === 'string') return m
      return String(m)
    }
    return String(x)
  } catch {
    return 'erro nao textualizavel'
  }
}


function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function redigirValores(
  texto: unknown,
  valores: (string | null | undefined)[],
): string {
  const bruto = textoDe(texto)

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const alvos = [...new Set(valores.filter((v): v is string => !!v && v.length >= PISO))]
    .sort((a, b) => b.length - a.length)

  
  
  
  
  
  
  
  
  
  
  let limpo = bruto
  for (const valor of alvos) {
    limpo = limpo.replace(new RegExp(escaparRegex(valor), 'gi'), '***')
    
    
    
    
    const codificado = encodeURIComponent(valor)
    if (codificado !== valor) {
      limpo = limpo.replace(new RegExp(escaparRegex(codificado), 'gi'), '***')
    }
  }
  return mensagemSegura(limpo)
}
