import { classificarChave, validarConfig } from '../../config-deploy.mjs'


export function urlSupabase(): string {
  return validarConfig(process.env).url
}


export function chaveParaONavegador(bruta: string): string {
  const chave = (bruta ?? '').trim()
  const tipo = classificarChave(chave)
  if (tipo === 'anon') return chave
  if (tipo === 'service') {
    throw new Error(
      'a chave de SERVIÇO está no campo da chave anônima — o navegador receberia acesso total ' +
        'ao banco. Confira as chaves do Supabase no painel do EasyPanel.',
    )
  }
  throw new Error(
    'a chave anônima do Supabase está vazia ou em formato desconhecido. Confira as chaves no ' +
      'painel do EasyPanel (Supabase → Settings → API Keys).',
  )
}
