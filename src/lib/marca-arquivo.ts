

export const LIMITE_BYTES = 512 * 1024


export function excedeLimite(bytes: number): boolean {
  return bytes > LIMITE_BYTES
}
