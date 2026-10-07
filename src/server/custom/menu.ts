import 'server-only'
import { cache } from 'react'
import { normalizarMenu, type ItemMenuCustom } from '@/lib/menu-custom'

/** Lê `custom/menu.ts`, a lista de telas próprias que o comprador quer no rail.
 *
 *  Qualquer falha vira lista vazia — arquivo ausente (o caso de 100% dos deploys hoje), erro
 *  de sintaxe, `export default` faltando, `throw` no topo. Nesses casos o rail volta a ser
 *  exatamente o que sempre foi, e o produto não perde nada.
 *
 *  `cache()` por request: o rail é renderizado em TODA navegação logada, e sem isso o
 *  `import()` seria resolvido de novo a cada tela. */
export const lerMenuCustom = cache(async (): Promise<ItemMenuCustom[]> => {
  try {
    const mod = await import(/* turbopackOptional: true */ '@custom/menu')
    return normalizarMenu((mod as { default?: unknown }).default)
  } catch {
    return []
  }
})
