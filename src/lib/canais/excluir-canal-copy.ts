






export type ContagemDoCanal = { conversas: number | null }


export type FatosDoCanal = {
  
  conexaoPareada: boolean
  
  faltaUrl: boolean
}


export function decisaoDoReligar(fatos: FatosDoCanal): { aparece: boolean; funciona: boolean } {
  return { aparece: fatos.conexaoPareada, funciona: fatos.conexaoPareada && !fatos.faltaUrl }
}

const NUNCA = 'Isso não tem volta.'


const O_QUE_VAI_JUNTO = 'com as mensagens e os arquivos (fotos, áudios e documentos) que chegaram por'


const INSTANCIA_PAGA =
  'A instância dele no servidor de mensagens também é apagada: reconectar depois cria outra, cobrada por lá.'




const RELIGAR = 'Se ele só parou de receber mensagens, Religar recebimento resolve sem apagar nada.'


export function fraseDeExclusaoDoCanal(
  contagem: ContagemDoCanal = { conversas: null },
  fatos: FatosDoCanal = { conexaoPareada: false, faltaUrl: true },
): string {
  const partes = [cascata(contagem.conversas)]
  if (fatos.conexaoPareada) partes.push(INSTANCIA_PAGA)
  partes.push(NUNCA)
  if (decisaoDoReligar(fatos).funciona) partes.push(RELIGAR)
  return partes.join(' ')
}

function cascata(conversas: number | null): string {
  
  
  
  
  if (conversas === 0) return 'Este canal ainda não tem nenhuma conversa gravada — não há histórico a perder aqui.'
  if (conversas === 1) return `A conversa deste canal vai junto, ${O_QUE_VAI_JUNTO} ela.`
  if (conversas !== null && conversas > 1) {
    return `As ${conversas.toLocaleString('pt-BR')} conversas deste canal vão junto, ${O_QUE_VAI_JUNTO} elas.`
  }
  
  
  return `Todas as conversas deste canal vão junto, ${O_QUE_VAI_JUNTO} elas.`
}


export const CONFIRMAR_EXCLUSAO_DO_CANAL = 'Excluir o canal e o histórico'
