














export type StatusDaMensagem =
  | 'recebida'
  | 'pendente'
  | 'enviada'
  | 'entregue'
  | 'lida'
  | 'falhou'
  | 'descartada'


export type FormaDaLinha =
  | { forma: 'rotulo'; texto: string }
  | { forma: 'nota' }
  | { forma: 'nada' }


const FORMA: Record<StatusDaMensagem, FormaDaLinha> = {
  recebida: { forma: 'nada' },
  pendente: { forma: 'rotulo', texto: 'na fila' },
  enviada: { forma: 'rotulo', texto: 'enviada' },
  entregue: { forma: 'rotulo', texto: 'entregue' },
  lida: { forma: 'rotulo', texto: 'lida' },
  falhou: { forma: 'rotulo', texto: 'falhou' },
  descartada: { forma: 'nota' },
}


export const STATUS_COM_FORMA = Object.keys(FORMA).sort()


export function formaDaLinha(status: string): FormaDaLinha {
  return FORMA[status as StatusDaMensagem] ?? { forma: 'nada' }
}


export const AUTOR_DA_NOTA = 'Aviso do CRM'
