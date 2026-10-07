


export function validarEntradasDoZip(nomes: string[]): void {
  for (const n of nomes) {
    const segmentos = String(n).split(/[\\/]/)
    const absoluto = n.startsWith('/') || n.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(n)
    const sobeArvore = segmentos.includes('..')
    
    
    const ehGit = segmentos.some((s) => s.toLowerCase() === '.git')

    if (absoluto || sobeArvore || ehGit) {
      
      
      throw new Error(`entrada de zip insegura: ${n}`)
    }
  }
}
