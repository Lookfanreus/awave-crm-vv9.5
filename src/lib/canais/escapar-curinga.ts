
export function escaparCuringa(termo: string): string {
  return termo.replace(/[\\%_*]/g, (c) => `\\\\${c}`)
}
