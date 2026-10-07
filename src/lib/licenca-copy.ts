

import type { EngineBlockReason } from '@platform/lib/license-state'

export type SituacaoLicenca =
  | 'sem_licenca' | 'ativa' | 'expirada' | 'revogada'
  | 'em_outra_maquina' | 'nunca_validou' | 'sem_confirmacao'

export type CopyLicenca = {
  
  selo: string
  
  tom: 'neutro' | 'ok' | 'alerta' | 'erro'
  
  titulo: string
  
  acao: string
}

const COPY: Record<SituacaoLicenca, CopyLicenca> = {
  sem_licenca: {
    selo: 'Sem licença',
    tom: 'neutro',
    titulo: 'O CRM funciona normalmente sem licença.',
    acao: 'A licença só habilita a atualização em um clique. Cole a chave que você recebeu na compra, se tiver uma.',
  },
  ativa: {
    selo: 'Ativa',
    tom: 'ok',
    titulo: 'Sua licença está ativa e confirmada.',
    acao: '',
  },
  nunca_validou: {
    selo: 'Aguardando confirmação',
    tom: 'alerta',
    titulo: 'A chave foi salva, mas o Hub ainda não confirmou.',
    
    
    acao: 'Isso costuma levar alguns segundos. Se continuar assim, confira se copiou a chave inteira e tente de novo — e, se ela veio de uma compra recente, aguarde alguns minutos antes de pedir suporte.',
  },
  sem_confirmacao: {
    selo: 'Sem confirmação recente',
    tom: 'alerta',
    titulo: 'O Hub não responde há vários dias.',
    acao: 'Seu CRM continua funcionando normalmente — nada foi bloqueado. Se o servidor tem acesso à internet, tente "Verificar agora".',
  },
  expirada: {
    selo: 'Expirada',
    tom: 'alerta',
    titulo: 'A janela de atualizações da sua licença terminou.',
    acao: 'Seu CRM continua funcionando e seus dados estão intactos. Renove para voltar a receber versões novas.',
  },
  revogada: {
    selo: 'Revogada',
    tom: 'erro',
    titulo: 'Esta licença foi cancelada.',
    acao: 'Se você não pediu cancelamento nem reembolso, fale com o suporte com esta tela aberta.',
  },
  em_outra_maquina: {
    selo: 'Em uso em outro servidor',
    tom: 'alerta',
    titulo: 'Esta chave já está ativa em outra instalação.',
    
    
    acao: 'Se você acabou de mudar de servidor, isso se resolve sozinho em até 24 horas. Se não foi você, fale com o suporte.',
  },
}

export function copyDaLicenca(s: SituacaoLicenca): CopyLicenca {
  return COPY[s] ?? COPY.nunca_validou
}


export function dataCurta(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}


export type MotivoBloqueio = EngineBlockReason

export type CopyBloqueio = {
  
  selo: string
  
  titulo: string
  
  acao: string
  
  podeRevalidar: boolean
  
  
  
}



const PARA_MEMBRO: CopyBloqueio = {
  selo: 'Acesso indisponível',
  titulo: 'O acesso a este servidor está indisponível no momento.',
  acao:
    'Não é problema no seu computador nem na sua conta. Avise o dono deste servidor — só ele ' +
    'consegue liberar o acesso. Seus dados continuam no banco e não foram apagados.',
  
  
  
  podeRevalidar: false,
}

const BLOQUEIO: Record<MotivoBloqueio, (ehDono: boolean) => CopyBloqueio> = {
  hard: (ehDono) =>
    ehDono
      ? {
          selo: 'Licença cancelada',
          titulo: 'Esta licença foi cancelada com reembolso dentro do prazo de garantia.',
          acao: 'Se você não pediu reembolso, fale com o suporte com esta tela aberta. Seus dados continuam no seu banco e não foram apagados.',
          podeRevalidar: false,
        }
      : PARA_MEMBRO,
  stale: (ehDono) =>
    ehDono
      ? {
          selo: 'Confirmação pendente',
          titulo: 'Não conseguimos confirmar sua licença há vários dias.',
          acao: 'Se este servidor tem acesso à internet, clique em "Verificar agora". Assim que a confirmação chegar, o acesso volta na hora.',
          podeRevalidar: true,
        }
      : PARA_MEMBRO,
}


export function copyDoBloqueio(motivo: MotivoBloqueio, ehDono: boolean): CopyBloqueio {
  return BLOQUEIO[motivo](ehDono)
}


export const MOTIVOS_BLOQUEIO = Object.keys(BLOQUEIO) as MotivoBloqueio[]


const ERROS_DE_CHAVE: Record<string, string> = {
  chave_vazia: 'Cole a chave antes de salvar.',
  
  
  
  chave_invalida: 'Isso é longo demais para ser uma chave. Confira se colou só a chave, sem o texto em volta.',
  falha_ao_salvar: 'Não deu para gravar a chave agora. Tente de novo em alguns instantes.',
  nao_autorizado: 'Só o dono deste servidor pode trocar a chave.',
}


export function copyDoErroDeChave(erro: string): string {
  return ERROS_DE_CHAVE[erro] ?? 'Não deu para salvar a chave agora. Tente de novo em alguns instantes.'
}
