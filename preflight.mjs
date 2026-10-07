








import { validarConfig, curarPortaPooler, ehDirectHost, tokenBootstrap } from './config-deploy.mjs'
import { TABELAS_NUCLEO, decidirBanco, deveImprimirChaveDePrimeiroAcesso, instrucaoDeAdocao } from './preflight-adocao.mjs'
import { recusaDoVector } from './preflight-vector.mjs'
import { readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'


async function sondarBanco(dbUrlBruta) {
  if (!dbUrlBruta || ehDirectHost(dbUrlBruta)) return { ok: false }
  const { url } = curarPortaPooler(dbUrlBruta)
  let postgres
  try {
    ;({ default: postgres } = await import('postgres'))
  } catch {
    return { ok: false }
  }
  const local = /127\.0\.0\.1|localhost/.test(url)
  let sql
  try {
    sql = postgres(url, { max: 1, ssl: local ? false : 'require', prepare: false, onnotice: () => {} })
  } catch {
    
    
    
    return { ok: false }
  }
  try {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    const alvos = ['awave_migrations', 'settings', ...TABELAS_NUCLEO]
    const r = await sql`select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ${sql(alvos)}`
    const achadas = new Set(r.map((linha) => linha.table_name))

    
    
    
    
    let bootstrapFeito = null
    if (achadas.has('settings')) {
      try {
        const b = await sql`select value from settings where key = 'bootstrap_feito' limit 1`
        if (b.length > 0) bootstrapFeito = String(b[0].value) === 'true'
      } catch {  }
    }

    
    
    
    
    
    
    
    
    
    
    
    
    
    const ext = await sql`
      select e.extname is not null as instalada,
             n.nspname             as schema,
             a.name is not null    as disponivel
        from (select 'vector'::text as nome) alvo
        left join pg_extension e on e.extname = alvo.nome
        left join pg_namespace n on n.oid = e.extnamespace
        left join pg_available_extensions a on a.name = alvo.nome`
    const v = ext[0] ?? null

    return {
      ok: true, bootstrapFeito,
      temRegistro: achadas.has('awave_migrations'),
      temTabelasDoCrm: TABELAS_NUCLEO.some((t) => achadas.has(t)),
      vector: {
        instalada: Boolean(v?.instalada),
        schema: v?.schema ?? null,
        disponivel: Boolean(v?.disponivel),
      },
    }
  } catch {
    return { ok: false } 
  } finally {
    
    
    await sql.end({ timeout: 5 })
  }
}

function imprimir(r, modo) {
  for (const a of r.avisos) console.warn(`[preflight] aviso (${a.campo}): ${a.titulo} ${a.comoResolver}`)
  for (const p of r.problemas) console.error(`[preflight] PROBLEMA (${p.campo}): ${p.titulo}\n            ${p.comoResolver}`)
  console.log(`[preflight] modo: ${modo}`)
}


async function versoesDaImagem() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'supabase', 'migrations')
  const arquivos = await readdir(dir).catch(() => [])
  return arquivos
    .map((name) => {
      const m = name.match(/^(\d{4})_.+\.sql$/)
      return m ? { version: m[1], name } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.version.localeCompare(b.version))
}

async function main() {
  const r = validarConfig(process.env)
  const sonda = await sondarBanco(process.env.SUPABASE_DB_URL)

  
  
  
  
  
  if (sonda.ok && decidirBanco(sonda) === 'adocao_pendente') {
    imprimir(r, 'exit')
    console.error('\n========================================')
    console.error(instrucaoDeAdocao(await versoesDaImagem()))
    console.error('========================================\n')
    return 1
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const recusaVector = recusaDoVector(sonda)
  if (recusaVector) {
    console.error(`[preflight] PROBLEMA (banco): ${recusaVector}`)
    return 1
  }

  if (r.problemas.length === 0) {
    imprimir(r, 'normal')
    
    
    const token = tokenBootstrap(r.serviceRole)
    
    
    
    if (token && deveImprimirChaveDePrimeiroAcesso(sonda?.bootstrapFeito ?? null)) {
      console.log('\n========================================')
      console.log('  CHAVE DO PRIMEIRO ACESSO: ' + token)
      console.log('  Use-a uma única vez, ao criar a conta do dono.')
      console.log('========================================\n')
    }
    return 0
  }

  
  
  
  
  const prova =
    r.todasAusentes ||
    process.env.AWAVE_DIAGNOSTICO === '1' ||
    (sonda.ok && decidirBanco(sonda) === 'virgem')

  if (!prova) {
    imprimir(r, 'exit')
    console.error(
      '[preflight] Não subindo: há problema de configuração e não dá pra provar que este ' +
      'servidor está vazio. Se o seu CRM ainda NÃO está no ar, adicione a variável ' +
      'AWAVE_DIAGNOSTICO=1 e faça deploy de novo pra ver o diagnóstico no navegador. ' +
      'Se ele JÁ está funcionando, não adicione nada: corrija a configuração e redeploy.',
    )
    return 1
  }

  imprimir(r, 'diagnostico')
  if (r.todasAusentes) {
    console.warn('[preflight] Se este CRM já funcionava, as variáveis de ambiente foram apagadas. Recoloque as três — nada foi perdido, seus dados estão no Supabase.')
  }
  return 2 
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error('[preflight] ERRO inesperado:', e?.message ?? e)
    process.exit(1)
  })
