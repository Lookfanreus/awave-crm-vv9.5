

import type { TipoGatilho } from '@/lib/estado-atualizacao'


export function textoDoRebuild(tipo: TipoGatilho | null): { frase: string; alerta: boolean } {
  if (tipo === 'disparado') {
    return {
      frase:
        'Enviado, e o seu servidor foi avisado — ele está reconstruindo agora. Leva alguns minutos, e a versão só muda no final. Pode fechar esta página.',
      alerta: false,
    }
  }
  if (tipo === 'falhou') {
    return {
      frase:
        'Enviado para o seu repositório, mas o aviso para o seu painel não passou — então o servidor ainda NÃO começou a reconstruir. Abra o EasyPanel e clique em Deploy uma vez. Seu código novo já está salvo, nada se perdeu.',
      alerta: true,
    }
  }
  return {
    frase:
      'Enviado para o seu repositório. Agora abra o EasyPanel e clique em Deploy uma vez — sem isso a versão não muda. Seu código novo já está salvo, nada se perdeu. Para não precisar fazer isso de novo, configure o Gatilho de Implantação abaixo.',
    alerta: true,
  }
}


export function mascararGatilho(segredo: string | null | undefined): string | null {
  if (!segredo) return null
  const cru = segredo.trim()
  if (!cru) return null

  let url: URL
  try {
    url = new URL(cru)
  } catch {
    return null
  }

  const host = url.host 
  if (!host) return null

  
  const segmentos = url.pathname.split('/').filter((s) => s.length > 0)
  const token = segmentos[segmentos.length - 1] ?? ''
  if (!token) return host 

  return `${host} …••••${token.slice(-4)}`
}


export function pareceUrlDeGatilho(entrada: string | null | undefined): boolean {
  const cru = String(entrada ?? '').trim()
  if (!cru) return false
  try {
    const url = new URL(cru)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
