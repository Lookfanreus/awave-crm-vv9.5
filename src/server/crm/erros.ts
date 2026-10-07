
export class CrmError extends Error {}

export class CrmSemPipelinePadrao extends CrmError {
  constructor() { super('Nenhum pipeline padrão configurado'); this.name = 'CrmSemPipelinePadrao' }
}
export class CrmEtapaDeOutroPipeline extends CrmError {
  constructor() { super('A etapa-alvo pertence a outro pipeline'); this.name = 'CrmEtapaDeOutroPipeline' }
}
export class CrmAtividadeSemAlvo extends CrmError {
  constructor() { super('Atividade precisa de ao menos um alvo (contato ou negócio)'); this.name = 'CrmAtividadeSemAlvo' }
}

export class CrmNegocioNaoEncontrado extends CrmError {
  constructor() { super('Negócio não encontrado'); this.name = 'CrmNegocioNaoEncontrado' }
}

export class CrmEtapaNaoEncontrada extends CrmError {
  constructor() { super('Etapa não encontrada'); this.name = 'CrmEtapaNaoEncontrada' }
}

export class CrmContatoNomeObrigatorio extends CrmError {
  constructor() { super('nome é obrigatório ao criar um contato'); this.name = 'CrmContatoNomeObrigatorio' }
}

export class CrmNegocioTituloObrigatorio extends CrmError {
  constructor() { super('titulo é obrigatório ao criar um negócio'); this.name = 'CrmNegocioTituloObrigatorio' }
}

export class CrmTipoDesconhecido extends CrmError {
  constructor(slug: string) { super(`Tipo de atividade desconhecido: ${slug}`); this.name = 'CrmTipoDesconhecido' }
}

export class CrmCamposInvalidos extends CrmError {
  constructor(readonly slugs: string[]) {
    super(`campos invalidos: ${slugs.join(', ')}`)
    this.name = 'CrmCamposInvalidos'
  }
}

export class CrmCamposObrigatorios extends CrmError {
  constructor(readonly slugs: string[]) {
    super(`campos obrigatorios da etapa: ${slugs.join(', ')}`)
    this.name = 'CrmCamposObrigatorios'
  }
}

export class CrmAutomacaoInvalida extends CrmError {
  constructor(readonly slugs: string[]) {
    super(`automação inválida: ${slugs.join(', ')}`)
    this.name = 'CrmAutomacaoInvalida'
  }
}

export class CrmRelatorioTipoInvalido extends CrmError {
  constructor(readonly tipo: string) {
    super(`tipo de relatório desconhecido: ${tipo}`)
    this.name = 'CrmRelatorioTipoInvalido'
  }
}

export class CrmAutomacaoAlvoInvalido extends CrmError {
  constructor() { super('a etapa ou funil da ação não existe neste espaço de trabalho'); this.name = 'CrmAutomacaoAlvoInvalido' }
}
