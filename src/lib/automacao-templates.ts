import { GATILHOS, ACOES, type Regra, type ItemAcao } from '@/lib/automacao-forma'




export type Pendencia = {
  
  campo: string
  
  texto: string
  bloqueiaSalvar: boolean
  
  emAberto: (regra: Regra) => boolean
}

export type TemplateRegra = {
  id: string
  
  nome: string
  
  descricao: string
  
  observacao?: string
  
  regra: Regra
  pendencias: Pendencia[]
}


function textoVazio(v: unknown): boolean {
  return typeof v !== 'string' || v.trim() === ''
}
function acaoDoTipo(regra: Regra, tipo: string): ItemAcao[] {
  return (regra.acoes ?? []).filter((a) => a?.tipo === tipo)
}

export const TEMPLATES: TemplateRegra[] = [
  {
    
    
    
    id: 'lead-parado-avisa-ia',
    nome: 'Lead parado há 3 dias avisa a IA',
    descricao:
      'Se um negócio aberto ficar 3 dias na mesma etapa sem andar, o CRM avisa a IA para ela cutucar o cliente.',
    
    
    
    
    
    
    observacao:
      'Só faz efeito com a IA plugada (Config › Integração por API). Sem um webhook ativo a regra roda e o log mostra "Executada" do mesmo jeito, mas o aviso não sai — o CRM não trata a IA ausente como erro.',
    regra: {
      nome: 'Lead parado há 3 dias avisa a IA',
      gatilho: 'negocio_parado',
      gatilho_config: { dias: 3 },
      condicoes: null,
      acoes: [{ tipo: 'chamar_webhook' }],
    },
    pendencias: [],
  },
  {
    
    
    
    
    
    id: 'ganho-cria-onboarding',
    nome: 'Negócio ganho abre o onboarding',
    descricao:
      'Toda venda fechada cria sozinha um negócio de onboarding, para o time de entrega tocar sem depender de alguém lembrar.',
    observacao:
      'Todos os onboardings nascem com o mesmo título — o CRM ainda não copia o nome do negócio que foi ganho.',
    regra: {
      nome: 'Negócio ganho abre o onboarding',
      gatilho: 'negocio_ganho',
      gatilho_config: {},
      condicoes: null,
      acoes: [{ tipo: 'criar_negocio', titulo: 'Onboarding — cliente novo' }],
    },
    pendencias: [
      {
        campo: 'Etapa inicial (na ação "Criar negócio")',
        texto:
          'Escolha onde o onboarding nasce — o ideal é a primeira etapa de um funil de Onboarding. Deixando em branco, ele nasce na primeira etapa do funil padrão, ou seja, de volta no começo do funil de vendas.',
        bloqueiaSalvar: false,
        emAberto: (r) => acaoDoTipo(r, 'criar_negocio').some((a) => textoVazio(a.etapa_id)),
      },
    ],
  },
  {
    
    
    
    
    
    
    id: 'proposta-agenda-follow-up',
    nome: 'Chegou na proposta, agenda o follow-up',
    descricao:
      'Quando um negócio entra na etapa de proposta, o CRM já deixa um follow-up marcado para dali a 2 dias.',
    regra: {
      nome: 'Chegou na proposta, agenda o follow-up',
      gatilho: 'negocio_movido',
      gatilho_config: {},
      condicoes: null,
      acoes: [{ tipo: 'criar_atividade', conteudo: 'Fazer follow-up da proposta enviada', vencimento_dias: 2 }],
    },
    pendencias: [
      {
        campo: 'Para',
        texto:
          'Escolha a sua etapa de proposta. Enquanto ficar em "Qualquer etapa", a regra agenda follow-up em toda mudança de etapa — não só na proposta.',
        bloqueiaSalvar: false,
        emAberto: (r) => textoVazio((r.gatilho_config ?? {}).para_etapa_id),
      },
      {
        campo: 'Tipo de atividade',
        texto:
          'Escolha o tipo do follow-up (Ligação, E-mail, Reunião…). Os tipos são seus, cada espaço de trabalho tem os seus — por isso o modelo não escolhe por você. Sem isso o CRM não deixa salvar.',
        bloqueiaSalvar: true,
        emAberto: (r) => acaoDoTipo(r, 'criar_atividade').some((a) => textoVazio(a.tipo_slug)),
      },
    ],
  },
]

export function templatePorId(id: string): TemplateRegra | undefined {
  return TEMPLATES.find((t) => t.id === id)
}


export function pendenciasAbertas(template: TemplateRegra, regra: Regra): Pendencia[] {
  return template.pendencias.filter((p) => p.emAberto(regra))
}


export function templateUsaCatalogoConhecido(t: TemplateRegra): boolean {
  if (!(GATILHOS as readonly string[]).includes(t.regra.gatilho)) return false
  return t.regra.acoes.every((a) => (ACOES as readonly string[]).includes(a.tipo))
}
