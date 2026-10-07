import 'server-only'
import manifesto from './awave-manifest.json'
import carimbo from './awave-stamp.json'




export function refDaRelease(): string | null {
  const ref = (manifesto as { ref?: unknown }).ref
  return typeof ref === 'string' && ref !== '' ? ref : null
}


export function licenciadoPara(): string | null {
  const l = (carimbo as { licensee?: unknown }).licensee
  return typeof l === 'string' && l !== '' ? l : null
}


export function versaoParaExibir(): string {
  return refDaRelease() ?? 'desenvolvimento'
}
