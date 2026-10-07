
































import { FILTROS, filtroValido } from './filtro-inbox'


function rotuloDo(filtro: unknown): string {
  const valido = filtroValido(filtro)
  return FILTROS.find((f) => f.valor === valido)!.rotulo
}


export function avisoDeBuscaQueNaoRodou(e: { filtroPedido: unknown; filtroEmMaos: unknown }): string {
  const trocouDeConjunto = filtroValido(e.filtroPedido) !== filtroValido(e.filtroEmMaos)
  
  
  
  const cabeca = trocouDeConjunto
    ? `Não foi possível mudar para “${rotuloDo(e.filtroPedido)}”. A lista abaixo ainda é “${rotuloDo(e.filtroEmMaos)}”.`
    : 'Não foi possível buscar agora. A lista abaixo é a de antes da busca.'
  return `${cabeca} A tela tenta de novo sozinha em até um minuto. Se não voltar, recarregue a página — sessão expirada leva ao login.`
}
