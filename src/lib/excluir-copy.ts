

export type AlvoExclusao = 'contato' | 'empresa' | 'negocio' | 'atividade'

export type ContagemEfeito = {
  atividades?: number
  historico?: number
}


function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`
}


export function fraseDoEfeito(alvo: AlvoExclusao, contagem: ContagemEfeito = {}): string {
  const nunca = 'Isso não pode ser desfeito.'

  if (alvo === 'empresa') {
    
    
    return `Os contatos e os negócios ligados a esta empresa continuam existindo, só perdem o vínculo com ela. ${nunca}`
  }

  if (alvo === 'contato') {
    const n = contagem.atividades ?? 0
    const atividades =
      n > 0
        ? ` ${plural(n, 'atividade', 'atividades')} dele ${n === 1 ? 'vai' : 'vão'} junto.`
        : ''
    return `Os negócios deste contato continuam existindo, só ficam sem contato.${atividades} ${nunca}`
  }

  if (alvo === 'negocio') {
    const a = contagem.atividades ?? 0
    const h = contagem.historico ?? 0
    const partes = [
      a > 0 ? plural(a, 'atividade', 'atividades') : null,
      h > 0 ? plural(h, 'registro de histórico', 'registros de histórico') : null,
    ].filter(Boolean) as string[]

    if (partes.length === 0) return `O contato e a empresa continuam existindo. ${nunca}`
    return `${partes.join(' e ')} ${partes.length === 1 && a === 1 ? 'vai' : 'vão'} junto. O contato e a empresa continuam existindo. ${nunca}`
  }

  return `Esta atividade sai da agenda e do histórico. ${nunca}`
}
