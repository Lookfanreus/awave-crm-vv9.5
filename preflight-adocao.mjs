




























export const TABELAS_NUCLEO = ['workspaces', 'membros', 'negocios', 'contatos', 'empresas']


export function decidirBanco({ temRegistro, temTabelasDoCrm }) {
  if (temRegistro) return 'registrado'
  return temTabelasDoCrm ? 'adocao_pendente' : 'virgem'
}


export function instrucaoDeAdocao(versoes) {
  const linhas = versoes.map((v) => `  ('${v.version}', '${v.name}')`).join(',\n')
  return [
    'Este banco de dados JÁ TEM tabelas do CRM, mas não tem o registro de quais',
    'migrations foram aplicadas (a tabela `public.awave_migrations`).',
    '',
    'O container NÃO vai subir assim — de propósito. Sem o registro, o instalador',
    'tentaria criar tabelas que já existem e pararia no meio.',
    '',
    'COMO RESOLVER (uma vez só, no SQL Editor do Supabase):',
    '',
    '1. Descubra em que versão este banco está. Se ele veio de uma instalação',
    '   anterior deste CRM, é a versão que aparecia no rodapé do /config.',
    '',
    '2. Rode o SQL abaixo REMOVENDO as linhas de versões que este banco ainda NÃO',
    '   tem. Registrar uma migration que não rodou faz ela ser pulada para sempre.',
    '',
    'create table if not exists public.awave_migrations (',
    '  version text primary key,',
    '  name text not null,',
    '  applied_at timestamptz not null default now()',
    ');',
    'alter table public.awave_migrations enable row level security;',
    'insert into public.awave_migrations (version, name) values',
    linhas + ';',
    '',
    '3. Faça o deploy de novo. O instalador vai aplicar só o que faltar.',
    '',
    'Na dúvida sobre o passo 1: um banco de uma instalação que estava ATUALIZADA',
    'recebe a lista inteira. Se você não tem certeza, NÃO CHUTE — peça suporte.',
  ].join('\n')
}


export function deveImprimirChaveDePrimeiroAcesso(bootstrapFeito) {
  return bootstrapFeito !== true
}
