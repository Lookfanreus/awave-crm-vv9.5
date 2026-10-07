















import type { StatusDaConversa } from './assumir'


export type FiltroDaInbox = 'ativas' | 'arquivadas'


export const FILTRO_PADRAO: FiltroDaInbox = 'ativas'


const CONJUNTOS: Record<FiltroDaInbox, readonly StatusDaConversa[]> = {
  ativas: ['aberta', 'assumida', 'aguardando_humano'],
  arquivadas: ['arquivada'],
}


export const FILTROS: ReadonlyArray<{ valor: FiltroDaInbox; rotulo: string }> = [
  { valor: 'ativas', rotulo: 'Conversas ativas' },
  { valor: 'arquivadas', rotulo: 'Conversas arquivadas' },
]


export function ehFiltroDaInbox(x: unknown): x is FiltroDaInbox {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(CONJUNTOS, x)
}


export function filtroValido(x: unknown): FiltroDaInbox {
  return ehFiltroDaInbox(x) ? x : FILTRO_PADRAO
}


export function statusDoFiltro(x: unknown): readonly StatusDaConversa[] {
  return CONJUNTOS[filtroValido(x)]
}


export function conjuntoTem(filtro: unknown, status: StatusDaConversa): boolean {
  return statusDoFiltro(filtro).includes(status)
}


export function arquivarTiraDaLista(filtro: unknown): boolean {
  return !conjuntoTem(filtro, 'arquivada')
}


export type VazioDaLista = { titulo: string; texto: string }


export function vazioDaLista(e: { filtro: unknown; busca: string }): VazioDaLista {
  const arquivadas = filtroValido(e.filtro) === 'arquivadas'
  if (e.busca) {
    return {
      titulo: arquivadas
        ? 'Nenhuma conversa arquivada com esse nome'
        : 'Nenhuma conversa ativa com esse nome',
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      texto:
        'A busca procura pelo nome do contato, dentro do conjunto que está sendo mostrado. Conversa de quem ainda não virou cadastro — grupo, ou contato apagado — não aparece por aqui: limpe a busca para vê-la na lista.',
    }
  }
  return arquivadas
    ? {
        titulo: 'Nenhuma conversa arquivada',
        texto:
          'As conversas que alguém arquivar ficam aqui, com o histórico inteiro — nada é apagado.',
      }
    : {
        titulo: 'Nenhuma conversa ainda',
        texto:
          'As conversas aparecem aqui assim que a primeira mensagem chegar pelo canal conectado.',
      }
}
