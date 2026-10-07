

import { ROTULO_ABA } from '@/lib/agentes-abas'

export type AssistenteResumido = {
  
  nomeInterno: string
  padrao: boolean
  
  canais: Array<{ id: string; nome: string }> | null
  
  blocosExclusivos: number | null
}


const SEM_NOME = 'Assistente sem nome'

const comNome = (n: string): string => (n.trim() ? n.trim() : SEM_NOME)


const SEM_NUMERO = 'Número sem nome'

const comNomeDeNumero = (n: string): string => (n.trim() ? n.trim() : SEM_NUMERO)


const NAO_LI_OS_NUMEROS = 'Não consegui ler em quais números este assistente atende agora.'
const RECARREGUE = 'Recarregue a página antes de mexer nele.'


export function motivoDeNaoExcluir(a: AssistenteResumido, total: number): string | null {
  if (total <= 1) {
    return 'É o único assistente deste espaço de trabalho. Sem nenhum, ele responde sem saber nada do seu negócio — edite este em vez de excluí-lo.'
  }
  if (a.padrao) {
    return 'É o assistente padrão: ele responde em todo número sem escolha própria. Marque outro como padrão antes.'
  }
  
  
  
  if (a.canais === null) return `${NAO_LI_OS_NUMEROS} ${RECARREGUE}`
  return null
}


export function quemRespondeNoCanal(
  agente: { nomeInterno: string } | null,
  padrao: { nomeInterno: string } | null,
): string {
  if (agente) return `Responde: ${comNome(agente.nomeInterno)}.`
  
  
  if (padrao) return `Sem escolha própria: responde o assistente padrão (${comNome(padrao.nomeInterno)}).`
  
  
  return 'Responde sem saber nada do seu negócio — nenhum assistente foi configurado ainda.'
}


export function canaisDoAssistente(a: AssistenteResumido): string {
  
  
  
  if (a.canais === null) return NAO_LI_OS_NUMEROS
  if (a.canais.length > 0) {
    return `Atende em: ${a.canais.map((c) => comNomeDeNumero(c.nome)).join(', ')}.`
  }
  if (a.padrao) {
    return 'Nenhum número escolheu este assistente — ele responde nos números sem escolha própria.'
  }
  return 'Nenhum número escolheu este assistente — ele nunca responde.'
}


export function motivoDeNaoTrocarNumero(a: AssistenteResumido): string | null {
  if (!a.canais || a.canais.length === 0) return null
  const nomes = a.canais.map((c) => comNomeDeNumero(c.nome)).join(', ')
  const jaAtende =
    a.canais.length === 1
      ? `Este agente já atende em ${nomes}.`
      : `Este agente atende em ${a.canais.length} números diferentes: ${nomes}.`
  return (
    `${jaAtende} Esta caixa só sabe ACRESCENTAR um número, nunca trocar. Para mudar quem ` +
    'responde num número, use a lista "Onde cada número responde", no fim desta aba.'
  )
}


export function seloDoAgente(
  a: AssistenteResumido,
  ligado: boolean | null,
): { texto: string; variante: 'ok' | 'neutro' } | null {
  
  
  if (a.canais === null) return null
  if (a.canais.length > 0) {
    if (ligado === null) return null
    return ligado
      ? { texto: 'Respondendo', variante: 'ok' }
      : { texto: 'Desligado', variante: 'neutro' }
  }
  if (a.padrao) return null
  return { texto: 'Sem número', variante: 'neutro' }
}


const NAO_LI_AS_ENTRADAS =
  'Não consegui ler quantas entradas da base de conhecimento estão restritas a este assistente — se houver alguma, ela passa a valer para todos os assistentes.'


export function avisoDaExclusao(a: AssistenteResumido): string {
  
  
  if (a.canais === null) return `${NAO_LI_OS_NUMEROS} ${RECARREGUE}`
  const nomes = a.canais.map((c) => comNomeDeNumero(c.nome)).join(', ')
  const dosNumeros =
    a.canais.length === 0
      ? 'Nenhum número aponta para este assistente.'
      : a.canais.length === 1
        ? `1 número passa a responder com o assistente padrão: ${nomes}.`
        : `${a.canais.length} números passam a responder com o assistente padrão: ${nomes}.`
  return [dosNumeros, daBase(a.blocosExclusivos)].filter(Boolean).join(' ')
}


function daBase(exclusivos: number | null): string {
  if (exclusivos === null) return NAO_LI_AS_ENTRADAS
  if (exclusivos === 0) return ''
  if (exclusivos === 1) {
    return '1 entrada ligada da base de conhecimento está restrita a este assistente e passa a valer para todos os assistentes.'
  }
  return `${exclusivos} entradas ligadas da base de conhecimento estão restritas a este assistente e passam a valer para todos os assistentes.`
}


const RESPONDER_POR_FORA =
  'Se preferir, responder o cliente por fora do CRM, direto pelo aplicativo de mensagens, também o cala naquela conversa, por 30 minutos.'


export function fraseDeResponderPorFora(
  canais: Array<{ nome: string; calaAoResponderDeFora: boolean }> | null,
): string | null {
  
  
  if (canais === null || canais.length === 0) return null
  const calam = canais.filter((c) => c.calaAoResponderDeFora)
  if (calam.length === 0) return null
  if (calam.length === canais.length) return RESPONDER_POR_FORA
  const nomes = calam.map((c) => comNomeDeNumero(c.nome)).join(', ')
  return `${RESPONDER_POR_FORA} Isso vale em: ${nomes}. Nos outros números desta lista, o que você responder por fora não chega ao CRM, e o assistente continua respondendo.`
}


export function motivoDeNaoAlternar({
  ehDono,
  temChave,
  ligado,
}: {
  ehDono: boolean
  temChave: boolean
  ligado: boolean
}): string | null {
  if (!ehDono) return 'Só quem instalou este CRM liga e desliga o assistente — peça a essa pessoa.'
  if (!ligado && !temChave) {
    
    
    
    
    
    return `Falta a chave da conta de inteligência artificial: cole-a na aba ${ROTULO_ABA.servidor}, em "A conta que paga as respostas".`
  }
  return null
}


export function blocosDoAssistente(quantidade: number): string {
  if (quantidade === 0) return 'Ainda não vê nenhuma das entradas ligadas da base de conhecimento.'
  const alcance =
    'parte entra sozinha em cada resposta, o resto ele só busca se precisar'
  if (quantidade === 1) return `Vê 1 das entradas ligadas da base de conhecimento — ${alcance}.`
  return `Vê ${quantidade} das entradas ligadas da base de conhecimento — ${alcance}.`
}
