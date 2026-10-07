


export function rotuloSemNome(membroId: string): string {
  return `Membro ${membroId.slice(0, 6)}`
}


export function nomeExibicao(
  meta: Record<string, unknown> | undefined,
  email: string | undefined | null,
  semNome = 'Usuário',
): string {
  const doMeta = meta?.nome ?? meta?.name ?? meta?.full_name
  if (typeof doMeta === 'string' && doMeta.trim()) return doMeta.trim()
  const local = email?.split('@')[0]?.trim()
  if (local) return local
  return semNome
}
