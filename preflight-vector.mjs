

























export const SCHEMA_DA_EXTENSAO = 'extensions'


export function decidirVector({ instalada, schema, disponivel }) {
  if (instalada) {
    return schema === SCHEMA_DA_EXTENSAO ? { ok: true } : { ok: false, motivo: 'schema_errado' }
  }
  return disponivel ? { ok: true } : { ok: false, motivo: 'indisponivel' }
}


export function instrucaoDoVector(motivo) {
  if (motivo === 'schema_errado') {
    return [
      'A busca por similaridade precisa da extensao `vector` no schema `extensions`, e neste',
      'banco ela esta em outro schema. No painel do Supabase, abra o SQL Editor e rode:',
      '',
      '  alter extension vector set schema extensions;',
      '',
      'Depois reinicie o aplicativo.',
    ].join('\n')
  }
  return [
    'Este banco nao oferece a extensao `vector`, necessaria para a busca por similaridade da',
    'base de conhecimento. No painel do Supabase, va em Database > Extensions e habilite',
    '`vector`. Se ela nao aparecer, o projeto e antigo demais e precisa ser atualizado pelo',
    'suporte do Supabase. Depois reinicie o aplicativo.',
  ].join('\n')
}


export function recusaDoVector(sonda) {
  if (!sonda?.ok || !sonda.vector) return null
  const v = decidirVector(sonda.vector)
  if (v.ok) return null
  return v.motivo === 'indisponivel' ? instrucaoDoVector(v.motivo) : null
}
