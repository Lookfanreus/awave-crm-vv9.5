


export type EstadoConexao = 'desconectado' | 'pareando' | 'conectado' | 'erro' | 'desconhecido'


export type TomDoSelo = 'ok' | 'neutro' | 'alerta' | 'erro'

export type EstadoDoCanal = {
  rotulo: string
  tom: TomDoSelo
  
  ajuda: string
}


const PAREADO: Record<EstadoConexao, EstadoDoCanal> = {
  conectado: {
    rotulo: 'Conectado',
    tom: 'ok',
    ajuda: 'O aparelho está pareado e as mensagens dos seus clientes chegam em Conversas.',
  },
  pareando: {
    rotulo: 'Pareando',
    tom: 'alerta',
    ajuda:
      'O código foi gerado e está esperando a leitura. Ele expira em poucos segundos — se sumir, gere outro.',
  },
  desconectado: {
    rotulo: 'Desconectado',
    tom: 'neutro',
    ajuda:
      'Nenhuma mensagem entra nem sai por este canal. Gere o código e leia no aparelho pra ligar de novo.',
  },
  erro: {
    rotulo: 'Com erro',
    tom: 'erro',
    ajuda:
      'O servidor de mensagens recusou este canal. Confira o endereço do servidor e pareie o aparelho de novo.',
  },
  desconhecido: {
    rotulo: 'Estado desconhecido',
    tom: 'neutro',
    ajuda:
      'Este CRM não reconhece o estado que veio do servidor de mensagens. Pareie de novo; se continuar, confira a versão do servidor.',
  },
}


const POR_CREDENCIAL: Record<EstadoConexao, EstadoDoCanal> = {
  conectado: {
    rotulo: 'Conectado',
    tom: 'ok',
    ajuda: 'As mensagens dos seus clientes chegam em Conversas.',
  },
  pareando: {
    rotulo: 'Pareando',
    tom: 'alerta',
    ajuda:
      'Este canal é o WhatsApp oficial: ele não pareia aparelho. Se ele aparece assim, a linha dele foi alterada fora do CRM.',
  },
  desconectado: {
    rotulo: 'Sem confirmação',
    tom: 'neutro',
    
    
    
    
    
    
    ajuda:
      'O WhatsApp oficial não avisa quando o canal está no ar, então este aviso não muda sozinho — nem depois da primeira mensagem. Se nada chega em Conversas, confira no painel da Meta os dois campos deste canal: o endereço de recebimento e a chave de assinatura do aplicativo.',
  },
  erro: {
    rotulo: 'Com erro',
    tom: 'erro',
    ajuda:
      'A Meta recusou este canal. Confira, no painel dela, o token de acesso e o identificador do número.',
  },
  desconhecido: {
    rotulo: 'Estado desconhecido',
    tom: 'neutro',
    ajuda:
      'Este CRM não reconhece o estado gravado neste canal. Ele não muda o recebimento: se nada chegar em Conversas, confira o painel da Meta.',
  },
}


export function estadoDoCanal(estado: EstadoConexao, conexaoPareada: boolean): EstadoDoCanal {
  return (conexaoPareada ? PAREADO : POR_CREDENCIAL)[estado]
}


export function fraseDeRejeitados(
  quantos: number,
  resolvePorIdentidade: boolean,
  contexto: {
    
    rejeitadoEm: string | null
    
    outroMotivo: number
    agoraMs: number
  },
): string | null {
  if (!Number.isFinite(quantos) || quantos <= 0) return null
  
  
  if (!resolvePorIdentidade) {
    return quantos === 1
      ? '1 evento recusado: alguém mandou um aviso que este canal não aceitou.'
      : `${quantos} eventos recusados: alguém mandou avisos que este canal não aceitou.`
  }

  const carimbo = contexto.rejeitadoEm ? Date.parse(contexto.rejeitadoEm) : Number.NaN
  
  
  
  const recente =
    Number.isFinite(carimbo) &&
    contexto.agoraMs - carimbo <= JANELA_RECUSA_RECENTE_MS &&
    !(Number.isFinite(contexto.outroMotivo) && contexto.outroMotivo > 0)

  
  
  const cabeca =
    quantos === 1
      ? '1 evento recusado: chegou aviso de um número ou conta'
      : `${quantos} eventos recusados: chegaram avisos de um número ou conta`
  const fato = `${cabeca} que não é de nenhum canal deste espaço de trabalho.`

  
  
  return recente
    ? `${fato} Se você ligou mais um número ou conta no mesmo aplicativo da Meta, crie o canal dele aqui — ele passa a receber pelo mesmo endereço que você já colou lá.`
    : `${fato} Não há recusa recente registrada: se as mensagens estão chegando normalmente, não há nada a fazer.`
}


export const JANELA_RECUSA_RECENTE_MS = 24 * 60 * 60 * 1000


export function fraseDeRejeitadosPorAssinatura(
  quantos: number,
  contexto: {
    
    rejeitadoEm: string | null
    
    outroMotivo: number
    agoraMs: number
  },
): string | null {
  if (!Number.isFinite(quantos) || quantos <= 0) return null

  const carimbo = contexto.rejeitadoEm ? Date.parse(contexto.rejeitadoEm) : Number.NaN
  
  
  
  const recente =
    Number.isFinite(carimbo) &&
    contexto.agoraMs - carimbo <= JANELA_RECUSA_RECENTE_MS &&
    !(Number.isFinite(contexto.outroMotivo) && contexto.outroMotivo > 0)

  const campo = 'chave de assinatura do aplicativo (App Secret)'
  const enderecoCerto = 'O endereço de recebimento está certo — os avisos chegaram até aqui.'

  if (recente) {
    const cabeca =
      quantos === 1
        ? '1 aviso foi recusado por assinatura, e ele chegou nas últimas 24 horas'
        : `${quantos} avisos foram recusados por assinatura, e o último chegou nas últimas 24 horas`
    return (
      `${cabeca}: enquanto a assinatura não confere, o que o cliente escreve não entra em ` +
      `Conversas. ${enderecoCerto} Reconfira a ${campo} no painel da Meta.`
    )
  }

  const cabeca =
    quantos === 1
      ? '1 aviso já foi recusado por assinatura neste canal'
      : `${quantos} avisos já foram recusados por assinatura neste canal`
  return (
    `${cabeca}. Se as mensagens deste número não estão chegando, o que não bate é a ${campo}: ` +
    `reconfira no painel da Meta. ${enderecoCerto}`
  )
}


export function fraseDeSegredoDeRecebimento(
  temSegredo: boolean,
  conexaoPareada: boolean,
): string | null {
  if (temSegredo) return null
  const comum =
    'Não encontrei o segredo do endereço de recebimento deste canal. Se as mensagens dos seus ' +
    'clientes pararam de chegar, é isto.'
  return conexaoPareada
    ? `${comum} Use “Religar recebimento” para gerar o endereço outra vez.`
    : `${comum} Neste tipo de canal o endereço não pode ser refeito: ele é gerado quando o canal é criado, e voltar a receber exige criar o canal de novo. Antes disso, saiba que apagar um canal leva junto as conversas e as mensagens dele — e que, se esta linha apareceu em TODOS os seus canais de uma vez, o mais provável é que o cofre de senhas do CRM esteja indisponível agora: espere alguns minutos e recarregue a página.`
}
