

















import { createHmac } from 'node:crypto'


export function extrairRef(dbUrl) {
  if (typeof dbUrl !== 'string' || dbUrl === '') return null
  let u
  try {
    u = new URL(dbUrl)
  } catch {
    return null
  }
  const usuario = decodeURIComponent(u.username || '')
  const m = usuario.match(/^postgres\.([a-z0-9]+)$/i)
  return m ? m[1] : null
}


export function derivarSupabaseUrl(dbUrl) {
  const ref = extrairRef(dbUrl)
  return ref ? `https://${ref}.supabase.co` : null
}


export function classificarChave(chave) {
  if (typeof chave !== 'string' || chave === '') return 'desconhecida'
  if (chave.startsWith('sb_publishable_')) return 'anon'
  if (chave.startsWith('sb_secret_')) return 'service'
  const partes = chave.split('.')
  if (partes.length !== 3) return 'desconhecida'
  try {
    const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'))
    if (payload.role === 'anon') return 'anon'
    if (payload.role === 'service_role') return 'service'
  } catch {
    
  }
  return 'desconhecida'
}

const PLACEHOLDERS = [/\[YOUR-PASSWORD\]/i, /\[YOUR_PASSWORD\]/i, /<PASSWORD>/i, /\[SUA-SENHA\]/i]

const ONDE_ACHAR_DB =
  'Supabase → Settings → Database → Connection string → aba "Session pooler". ' +
  'Troque [YOUR-PASSWORD] pela senha do BANCO (não é a senha da sua conta Supabase).'
const ONDE_ACHAR_CHAVES = 'Supabase → Settings → API Keys.'


export function ehDirectHost(dbUrl) {
  if (typeof dbUrl !== 'string') return false
  return /@db\.[a-z0-9]+\.supabase\.co([:/]|$)/i.test(dbUrl)
}


export function curarPortaPooler(dbUrl) {
  if (typeof dbUrl !== 'string') return { url: dbUrl, curado: false }
  if (/@[^@/]*\.pooler\.supabase\.com:6543([/?]|$)/.test(dbUrl)) {
    return { url: dbUrl.replace(/:6543([/?]|$)/, ':5432$1'), curado: true }
  }
  return { url: dbUrl, curado: false }
}


export function validarConfig(env = {}) {
  const texto = (v) => (typeof v === 'string' ? v.trim() : '')
  const dbUrl = texto(env.SUPABASE_DB_URL)
  const anon = texto(env.SUPABASE_ANON_KEY)
  const service = texto(env.SUPABASE_SERVICE_ROLE_KEY)
  const urlExplicita = texto(env.SUPABASE_URL)

  const problemas = []
  const avisos = []
  const add = (lista, codigo, campo, titulo, comoResolver) =>
    lista.push({ codigo, campo, titulo, comoResolver })

  const derivada = derivarSupabaseUrl(dbUrl)
  const url = urlExplicita || derivada || ''

  if (!dbUrl) {
    if (urlExplicita) {
      add(avisos, 'db_url_ausente', 'SUPABASE_DB_URL',
        'Migrations automáticas desligadas.',
        'Sem SUPABASE_DB_URL o app sobe, mas você aplica as migrations na mão. ' + ONDE_ACHAR_DB)
    } else {
      add(problemas, 'db_url_ausente', 'SUPABASE_DB_URL',
        'Falta a connection string do banco.', ONDE_ACHAR_DB)
    }
  } else if (PLACEHOLDERS.some((re) => re.test(dbUrl))) {
    add(problemas, 'db_url_senha_placeholder', 'SUPABASE_DB_URL',
      'A connection string ainda está com o texto de exemplo no lugar da senha.',
      'Troque [YOUR-PASSWORD] pela senha do BANCO. ' + ONDE_ACHAR_DB)
  } else if (ehDirectHost(dbUrl)) {
    add(problemas, 'db_url_direct_ipv6', 'SUPABASE_DB_URL',
      'Essa é a "Direct connection", que só funciona por IPv6 e não resolve no EasyPanel.',
      'Use a aba "Session pooler" (host ...pooler.supabase.com, usuário postgres.<ref>, porta 5432). ' + ONDE_ACHAR_DB)
  } else {
    if (curarPortaPooler(dbUrl).curado) {
      add(avisos, 'db_url_transaction_pooler', 'SUPABASE_DB_URL',
        'Você colou o transaction pooler (porta 6543); usaremos a 5432 sozinhos.',
        'Nada a fazer. Se quiser deixar exato, troque 6543 por 5432.')
    }
    if (!derivada && !urlExplicita) {
      add(problemas, 'db_url_sem_ref', 'SUPABASE_URL',
        'Não consegui descobrir o endereço do seu projeto a partir da connection string.',
        'Adicione também a variável SUPABASE_URL (ex.: https://<ref>.supabase.co). ' + ONDE_ACHAR_CHAVES)
    }
  }

  if (!anon) {
    add(problemas, 'anon_ausente', 'SUPABASE_ANON_KEY', 'Falta a chave pública (anon).', ONDE_ACHAR_CHAVES)
  }
  if (!service) {
    add(problemas, 'service_role_ausente', 'SUPABASE_SERVICE_ROLE_KEY',
      'Falta a chave secreta (service_role).', ONDE_ACHAR_CHAVES)
  }
  
  
  
  
  
  if (anon && service && anon === service) {
    add(problemas, 'chaves_iguais', 'SUPABASE_SERVICE_ROLE_KEY',
      'Você colou a MESMA chave nos dois campos.',
      'São duas chaves diferentes: a pública (anon / sb_publishable_) e a secreta ' +
      '(service_role / sb_secret_). ' + ONDE_ACHAR_CHAVES)
  }
  if (anon && service && classificarChave(anon) === 'service' && classificarChave(service) === 'anon') {
    add(problemas, 'chaves_trocadas', 'SUPABASE_ANON_KEY',
      'As duas chaves estão trocadas de lugar.',
      'A chave pública (anon / sb_publishable_) vai em SUPABASE_ANON_KEY e a secreta ' +
      '(service_role / sb_secret_) em SUPABASE_SERVICE_ROLE_KEY. ' + ONDE_ACHAR_CHAVES)
  }

  return {
    url,
    anon,
    serviceRole: service,
    problemas,
    avisos,
    
    todasAusentes: !dbUrl && !anon && !service && !urlExplicita,
  }
}


export function tokenBootstrap(serviceRoleKey) {
  if (typeof serviceRoleKey !== 'string' || serviceRoleKey === '') return null
  return createHmac('sha256', serviceRoleKey).update('awave-bootstrap').digest('hex').slice(0, 12).toUpperCase()
}
