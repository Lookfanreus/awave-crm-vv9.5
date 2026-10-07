// migrate.mjs — runner de migrations embutido no container (roda no boot, ANTES do server.js).
// Node puro, sem imports do app. Única dep: node_modules/postgres (copiada no Dockerfile).
//
// Regras:
//  - Sem SUPABASE_DB_URL      → no-op (exit 0): instalação antiga segue no fluxo manual.
//  - Banco VIRGEM             → aplica TODAS as migrations em ordem (setup zero-toque).
//  - Existente COM baseline   → aplica só as pendentes (registro em public.awave_migrations).
//  - Existente SEM baseline   → exit 1 com instrução clara (última atualização manual, DEPLOY.md §7).
//  - Cada migration roda numa transação própria; o registro entra na MESMA transação.
//  - pg_advisory_lock serializa runners concorrentes (deploy com 2 containers vivos).
//  - tx.unsafe(conteúdo) sem params usa o simple protocol → aceita múltiplos statements
//    por arquivo. Migration futura que NÃO possa rodar em transação (ex.: CREATE INDEX
//    CONCURRENTLY) exigiria um marcador `-- awave:no-transaction` — não implementado (YAGNI).
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const LOCK_KEY = 7455101

export function parseMigrationFile(name) {
  const m = name.match(/^(\d{4})_.+\.sql$/)
  return m ? { version: m[1], name } : null
}

// Faixa reservada às migrations do CLIENTE (custom/migrations): 9000–9999.
// Oficiais (supabase/migrations) ficam SEMPRE abaixo — namespaces disjuntos
// matam a colisão silenciosa de numeração entre release e customização.
export const CUSTOM_RANGE_START = '9000'
export function isCustomerVersion(version) {
  return version >= CUSTOM_RANGE_START // 4 dígitos: comparação lexicográfica == numérica
}

// PURA: decide o que aplicar. `files` = supabase/migrations (oficiais);
// `customFiles` = custom/migrations do comprador (OPCIONAL — ausente = zero mudança
// de comportamento pro parque instalado); `applied` = Set<string> de versões
// registradas; `dbIsFresh` = banco sem a tabela sentinela (sync_state, da 0001).
// (o cast JSDoc no default evita o TS inferir `never[]` pro parâmetro em quem chama)
export function planMigrations({ files, customFiles = /** @type {string[]} */ ([]), applied, dbIsFresh }) {
  const oficiais = files
    .map(parseMigrationFile)
    .filter(Boolean)
    .map((m) => ({ ...m, origem: 'oficial' }))
  const custom = customFiles
    .map(parseMigrationFile)
    .filter(Boolean)
    .map((m) => ({ ...m, origem: 'custom' }))
  // A validação de FAIXA roda ANTES do check de duplicata: com namespaces válidos
  // (oficial < 9000, custom >= 9000) uma duplicata ENTRE pastas é impossível — o
  // check de duplicata abaixo só precisa olhar o conjunto mesclado.
  const customFora = custom.find((m) => !isCustomerVersion(m.version))
  if (customFora) return { error: 'custom_fora_da_faixa', apply: [], arquivo: customFora.name }
  const oficialNaFaixa = oficiais.find((m) => isCustomerVersion(m.version))
  if (oficialNaFaixa) return { error: 'oficial_na_faixa_custom', apply: [], arquivo: oficialNaFaixa.name }
  const migrations = [...oficiais, ...custom]
    .sort((a, b) => a.version.localeCompare(b.version))
  const dup = migrations.find((m, i) => i > 0 && m.version === migrations[i - 1].version)
  if (dup) return { error: 'duplicate_version', apply: [], duplicate: dup.version }
  if (!dbIsFresh && applied.size === 0) return { error: 'baseline_missing', apply: [] }
  const apply = migrations.filter((m) => !applied.has(m.version))
  // L4: guard fora-de-ordem POR NAMESPACE. Sob disciplina expand-only os números só
  // sobem; uma pendente ABAIXO da última já aplicada é quase certamente erro de
  // empacotamento (rodaria DEPOIS de migrations de número maior). O max é por
  // namespace — um max GLOBAL faria a primeira custom aplicada (9xxx) acusar TODA
  // oficial futura (< 9000) como fora de ordem. Sinaliza, mas NÃO recusa (não brica
  // o boot num edge) — o main() só avisa e aplica mesmo assim.
  const appliedVersions = [...applied]
  const maxOf = (versions) =>
    versions.length > 0 ? versions.sort((a, b) => a.localeCompare(b)).pop() : null
  const maxOficial = maxOf(appliedVersions.filter((v) => !isCustomerVersion(v)))
  const maxCustom = maxOf(appliedVersions.filter((v) => isCustomerVersion(v)))
  const outOfOrder = apply
    .filter((m) => {
      const max = m.origem === 'custom' ? maxCustom : maxOficial
      return max !== null && m.version.localeCompare(max) < 0
    })
    .map((m) => m.version)
  return { error: null, apply, outOfOrder }
}

/**
 * PURA: auto-heal do pooler do Supabase. O Session pooler (porta 5432) e o
 * Transaction pooler (6543) compartilham o MESMO host (`*.pooler.supabase.com`) —
 * só a porta muda. O runner exige o 5432 (o advisory lock é por SESSÃO; no 6543
 * cada statement pode cair num backend diferente e a trava quebra em silêncio). O
 * leigo costuma copiar o 6543 do painel → em vez de recusar e deixar o container
 * sem subir, corrigimos sozinhos. Qualquer OUTRO :6543 (host não-Supabase) fica
 * intacto (`healed:false`) → o guard do main() ainda o recusa (não dá pra assumir
 * que um Postgres qualquer no 6543 aceita o 5432).
 */
export function healSupabasePoolerPort(dbUrl) {
  if (typeof dbUrl !== 'string') return { url: dbUrl, healed: false }
  // Ancora o pooler.supabase.com:6543 no segmento de HOST (após @, sem / nem @ no
  // meio) seguido de /, ? ou fim — um :6543 dentro da senha (antes do @) não casa.
  if (/@[^@/]*\.pooler\.supabase\.com:6543([/?]|$)/.test(dbUrl)) {
    return { url: dbUrl.replace(/:6543([/?]|$)/, ':5432$1'), healed: true }
  }
  return { url: dbUrl, healed: false }
}

/**
 * PURA: a URL é a Direct connection do Supabase (host `db.<ref>.supabase.co`)?
 * A Direct connection é IPv6-only na maioria dos projetos → dá `getaddrinfo
 * ENOTFOUND` num host IPv4 (EasyPanel & cia.). O comprador precisa da Session
 * pooler (host `...pooler.supabase.com`, usuário `postgres.<ref>`). Detectamos pra
 * trocar o ENOTFOUND críptico por uma instrução clara ANTES de tentar conectar.
 * Ancorado no segmento de HOST (após @) — `db.<ref>.supabase.co` no path/senha não casa.
 */
export function isSupabaseDirectHost(dbUrl) {
  if (typeof dbUrl !== 'string') return false
  return /@db\.[a-z0-9]+\.supabase\.co([:/]|$)/i.test(dbUrl)
}

async function main() {
  const rawDbUrl = process.env.SUPABASE_DB_URL
  if (!rawDbUrl) {
    console.log('[migrate] SUPABASE_DB_URL ausente — pulando (migrations seguem no fluxo manual).')
    return 0
  }
  // Auto-heal do pooler do Supabase (6543→5432): mesmo host, só a porta muda. O leigo
  // copia o 6543 do painel; corrigimos em vez de deixar o container sem subir.
  const { url: dbUrl, healed } = healSupabasePoolerPort(rawDbUrl)
  if (healed) {
    console.warn('[migrate] SUPABASE_DB_URL apontava pro transaction pooler (6543); usando o session pooler (5432) automaticamente.')
  }
  // #10: um :6543 que NÃO seja o pooler do Supabase a gente não pode assumir que mapeia
  // pra 5432 — mantém a recusa (o advisory lock é POR SESSÃO e no 6543 cada statement pode
  // cair num backend diferente). Casa a :6543 na posição de PORTA (antes de /path, ?query
  // ou fim) — sem falso-positivo com 6543 dentro de senha/dbname.
  if (/:6543([/?]|$)/.test(dbUrl)) {
    console.error('[migrate] SUPABASE_DB_URL usa o transaction pooler (porta 6543), incompatível com o runner (advisory lock é por sessão). Use o Session pooler (porta 5432) — DEPLOY.md §2.1.')
    return 1
  }
  // Direct connection do Supabase (db.<ref>.supabase.co) é IPv6-only → dá ENOTFOUND num
  // host IPv4 (EasyPanel). Troca o erro críptico por instrução clara ANTES de conectar.
  if (isSupabaseDirectHost(dbUrl)) {
    console.error('[migrate] SUPABASE_DB_URL usa a Direct connection do Supabase (db.<ref>.supabase.co), que é só IPv6 e não resolve no EasyPanel/maioria dos hosts (ENOTFOUND). Use a Session pooler: Supabase → Settings → Database → Connection string → aba "Session pooler" (host ...pooler.supabase.com, usuário postgres.<ref>, porta 5432). Ver DEPLOY.md §2.1.')
    return 1
  }
  const { default: postgres } = await import('postgres')
  const local = /127\.0\.0\.1|localhost/.test(dbUrl)
  const sql = postgres(dbUrl, {
    max: 1,
    ssl: local ? false : 'require',
    prepare: false,
    onnotice: (n) => console.log('[migrate] pg:', n.severity ?? 'NOTICE', n.message), // default despeja o objeto cru e enterra o log de boot
  })
  try {
    // #11: conexão inicial com retry curto e limitado. postgres.js conecta lazy — o
    // `select 1` é a sonda de conectividade (sem efeito colateral) e é a ÚNICA coisa que
    // retentamos: um soluço transitório do banco no boot não deve virar exit 1 (crashloop)
    // numa instalação nova. Depois da sonda, falha de migration é erro real → exit 1 (sem
    // retry). URL com typo permanente esgota as tentativas e sai 1 (correto).
    const attempts = Math.max(1, Number(process.env.MIGRATE_CONNECT_ATTEMPTS) || 3)
    for (let i = 1; ; i++) {
      try {
        await sql`select 1`
        break
      } catch (err) {
        if (i >= attempts) throw err
        const backoff = 1000 * i // 1s, 2s, …
        console.warn(`[migrate] conexão falhou (tentativa ${i}/${attempts}: ${err?.message ?? err}) — novo teste em ${backoff}ms`)
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
    // L3: lock_timeout ANTES do pg_advisory_lock — assim a própria espera pela trava
    // (não só o DDL) fica limitada a 15s. Se um boot concorrente segura a trava e trava,
    // este boot não espera pra sempre: expira → exit 1 → EasyPanel mantém/retenta o antigo.
    // (Sem statement_timeout: um backfill legítimo longo não pode ser morto.)
    await sql.unsafe(`set lock_timeout = '15s'`)
    await sql`select pg_advisory_lock(${LOCK_KEY})`
    await sql`create table if not exists public.awave_migrations (
      version text primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )`
    // idempotente; fecha a janela em que uma falha no meio do run numa instalação nova
    // deixaria a tabela sem RLS (legível pelo anon via PostgREST) até a 0046 aplicar
    await sql`alter table public.awave_migrations enable row level security`
    const sentinel = await sql`select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'sync_state'`
    const applied = new Set((await sql`select version from public.awave_migrations`).map((r) => r.version))
    const dir = join(dirname(fileURLToPath(import.meta.url)), 'supabase', 'migrations')
    const files = await readdir(dir)
    // Zona do comprador: custom/migrations (faixa 9000+). Pasta ausente/deletada =
    // lista vazia, SEM ENOENT — o boot NUNCA morre por falta da pasta custom.
    // Só ENOENT é tolerado: EACCES/EIO subiriam o container SEM as migrations do
    // cliente em silêncio — nesses casos, falha (container antigo segue no ar).
    const customDir = join(dirname(fileURLToPath(import.meta.url)), 'custom', 'migrations')
    const customFiles = await readdir(customDir).catch((err) => {
      if (err?.code === 'ENOENT') return []
      throw err // dir EXISTE mas não lê → exit 1 via main().catch; container antigo segue no ar
    })
    for (const name of [...files, ...customFiles]) {
      // só .sql fora do padrão avisa — LEIA-ME.md e afins passam em silêncio
      if (name.endsWith('.sql') && !parseMigrationFile(name)) {
        console.warn('[migrate] ignorando arquivo fora do padrão: ' + name)
      }
    }
    const plan = planMigrations({ files, customFiles, applied, dbIsFresh: sentinel.length === 0 })
    if (plan.error === 'custom_fora_da_faixa') {
      console.error(
        `[migrate] Migration em custom/migrations fora da faixa reservada (9000–9999): ${plan.arquivo}. ` +
        'Renomeie pro prefixo 9000+ e reinicie. (Numa atualização, o container atual continua no ar até isso ser corrigido.)'
      )
      return 1
    }
    if (plan.error === 'oficial_na_faixa_custom') {
      console.error(
        `[migrate] Migration OFICIAL (supabase/migrations) dentro da faixa reservada ao cliente (9000–9999): ${plan.arquivo}. ` +
        'Isso é erro de empacotamento da release — migrations oficiais usam prefixo abaixo de 9000. ' +
        '(Numa atualização, o container atual continua no ar até isso ser corrigido.)'
      )
      return 1
    }
    if (plan.error === 'duplicate_version') {
      // faixas disjuntas (oficial < 9000, custom >= 9000) → a duplicata é sempre
      // DENTRO de uma pasta só; aponte a certa pro comprador não caçar na errada
      const pastaDup = isCustomerVersion(plan.duplicate) ? 'custom/migrations' : 'supabase/migrations'
      console.error(
        `[migrate] Versão duplicada nas migrations: ${plan.duplicate} — ` +
        `dois arquivos em ${pastaDup} com o mesmo prefixo. Corrija antes de subir.`
      )
      return 1
    }
    if (plan.error === 'baseline_missing') {
      console.error(
        '[migrate] Banco existente sem baseline (public.awave_migrations vazia). ' +
        'Aplique as migrations pendentes manualmente UMA última vez — até a migration de ' +
        'baseline (a que cria public.awave_migrations) — e rebuilde (DEPLOY.md §7).'
      )
      return 1
    }
    if (plan.outOfOrder && plan.outOfOrder.length > 0) {
      console.warn(
        '[migrate] AVISO: migration(s) fora de ordem (abaixo da última aplicada): ' +
        plan.outOfOrder.join(', ') + ' — verifique o empacotamento'
      )
    }
    if (plan.apply.length === 0) {
      console.log('[migrate] Nenhuma migration pendente.')
      return 0
    }
    for (const m of plan.apply) {
      const content = await readFile(join(m.origem === 'custom' ? customDir : dir, m.name), 'utf8')
      console.log(`[migrate] Aplicando ${m.name}…`)
      await sql.begin(async (tx) => {
        await tx.unsafe(content)
        await tx`insert into public.awave_migrations (version, name)
          values (${m.version}, ${m.name}) on conflict (version) do nothing`
      })
    }
    console.log(`[migrate] OK — ${plan.apply.length} migration(s) aplicada(s).`)
    return 0
  } finally {
    await sql.end({ timeout: 5 })
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('[migrate] ERRO:', err?.message ?? err)
      process.exit(1) // falha → container não sobe → EasyPanel mantém o antigo servindo
    })
}
