


export type AlvoDoArraste = { active: { id: string | number }; over?: { id: string | number } | null }


export const PAPEL_ARRASTAVEL = 'item reordenável'


export const INSTRUCAO_DE_ARRASTE =
  'Aperte a barra de espaço para pegar. Use as setas para mover e a barra de espaço de novo ' +
  'para soltar. Esc cancela.'


export function anunciosDeArraste(nomeDe: (id: string) => string) {
  const rotulo = (id: string | number) => nomeDe(String(id)).trim() || 'o item'

  return {
    onDragStart: ({ active }: AlvoDoArraste) => `Você pegou ${rotulo(active.id)}.`,

    
    
    
    
    
    onDragOver: ({ active, over }: AlvoDoArraste) => {
      if (!over) return `${rotulo(active.id)} não está sobre nenhum destino.`
      if (String(over.id) === String(active.id)) return `Você pegou ${rotulo(active.id)}.`
      return `${rotulo(active.id)} está sobre ${rotulo(over.id)}.`
    },

    
    
    
    
    
    
    
    
    onDragEnd: ({ active, over }: AlvoDoArraste) => {
      const nome = rotulo(active.id)
      if (!over) return `${nome} foi solto fora de um destino e voltou para o lugar.`
      if (String(over.id) === String(active.id)) return `${nome} não mudou de lugar.`
      return `${nome} foi para ${rotulo(over.id)}.`
    },

    
    
    onDragCancel: ({ active }: AlvoDoArraste) => `Arraste cancelado. ${rotulo(active.id)} continua onde estava.`,
  }
}
