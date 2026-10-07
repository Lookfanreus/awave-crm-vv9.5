


const MIN_DIGITOS = 8


const MAX_DIGITOS = 15


export function normalizarTelefone(id: string | null | undefined): string | null {
  if (!id) return null
  if (id.includes('@lid')) return null
  const digitos = id.split(/[@:]/)[0].replace(/\D/g, '')
  return digitos.length >= MIN_DIGITOS && digitos.length <= MAX_DIGITOS ? digitos : null
}

const DDI_BR = '55'


type Canonico = string


const DDD = /^[1-9][1-9]$/


function canonicalizar(digitos: string): Canonico | null {
  
  
  
  const nacional =
    digitos.startsWith(DDI_BR) && (digitos.length === 13 || digitos.length === 12)
      ? digitos.slice(2)
      : digitos

  
  
  
  if (nacional.length !== 11 && nacional.length !== 10) return null

  const ddd = nacional.slice(0, 2)
  if (!DDD.test(ddd)) return null
  const local = nacional.slice(2)

  
  
  if (local.length === 9) return local.startsWith('9') ? ddd + local : null

  
  
  
  if (/^[2-5]/.test(local)) return ddd + local
  if (/^[6-9]/.test(local)) return ddd + '9' + local
  return null
}


export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarTelefone(a)
  const nb = normalizarTelefone(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const ca = canonicalizar(na)
  const cb = canonicalizar(nb)
  return ca !== null && ca === cb
}


export function sufixoTelefone(id: string | null | undefined): string | null {
  const digitos = normalizarTelefone(id)
  return digitos ? digitos.slice(-8) : null
}
