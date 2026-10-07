


export const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export type TipoAnexo = (typeof TIPOS_PERMITIDOS)[number]


export const TAMANHO_MAX = 10 * 1024 * 1024


export const EXTENSAO: Record<TipoAnexo, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export type ResultadoAnexo = { ok: true } | { ok: false; erro: string }

export function validarAnexo(a: { tipo?: string; tamanho?: number }): ResultadoAnexo {
  if (!a.tipo || !TIPOS_PERMITIDOS.includes(a.tipo as TipoAnexo)) return { ok: false, erro: 'tipo_invalido' }
  
  
  if (!a.tamanho || a.tamanho <= 0) return { ok: false, erro: 'sem_arquivo' }
  if (a.tamanho > TAMANHO_MAX) return { ok: false, erro: 'arquivo_grande' }
  return { ok: true }
}


export function nomeSeguro(bruto: string): string {
  const limpo = bruto
    .replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/[/\\]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/["';]/g, '')
    .trim()
  if (!limpo) return 'arquivo'
  
  return limpo.length > 120 ? limpo.slice(0, 120) : limpo
}


export function caminhoDoAnexo(workspaceId: string, negocioId: string, id: string, tipo: TipoAnexo): string {
  return `${workspaceId}/${negocioId}/${id}.${EXTENSAO[tipo]}`
}


export function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1).replace('.', ',')} MB`
}


export const ERRO_ANEXO: Record<string, string> = {
  tipo_invalido: 'Só dá para anexar PDF, PNG, JPEG ou WEBP.',
  arquivo_grande: 'O arquivo passa de 10 MB.',
  sem_arquivo: 'Escolha um arquivo.',
  nao_encontrado: 'Esse anexo não existe mais.',
  sem_workspace: 'Escolha um espaço de trabalho antes.',
  falha_enviar: 'Não consegui enviar. Tente de novo.',
  falha_excluir: 'Não consegui excluir. Tente de novo.',
  falha_link: 'Não consegui gerar o link. Tente de novo.',
}
