











import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const VENENO_REF = 'aaaaaaaaaaaaaaaaaaaa' 
const VENENO_URL = `https://${VENENO_REF}.supabase.co`
const NEXT_BIN = createRequire(import.meta.url).resolve('next/dist/bin/next')

console.log('[anti-inlining] buildando com NEXT_PUBLIC_SUPABASE_URL envenenada…')
execFileSync(process.execPath, [NEXT_BIN, 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: VENENO_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'veneno',
  },
})






const STANDALONE = '.next/standalone'
const RAIZ_CLIENTE = '.next/static'





















function raizesDoStandalone(dir) {
  if (!existsSync(dir)) return []
  const achadas =
    existsSync(join(dir, 'server.js')) && existsSync(join(dir, '.next', 'server')) ? [dir] : []
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) achadas.push(...raizesDoStandalone(p))
  }
  return achadas
}
const raizes = raizesDoStandalone(STANDALONE)
if (raizes.length === 0) {
  
  
  console.error(
    `[anti-inlining] FALHOU: não achei nenhuma raiz de standalone sob ${STANDALONE}/ ` +
      '(procuro um diretório com `server.js` e `.next/server` juntos). ' +
      "Rode `pnpm build` e confira que o next.config.ts ainda tem `output: 'standalone'`.",
  )
  process.exit(1)
}
if (raizes.length > 1) {
  
  
  
  
  
  
  console.error(
    `[anti-inlining] FALHOU: achei ${raizes.length} raízes de standalone (${raizes.join(', ')}). ` +
      'Não dá pra saber qual delas vira a imagem. Rode `rm -rf .next` e builde de novo.',
  )
  process.exit(1)
}
const RAIZ_SERVIDOR = join(raizes[0], '.next', 'server', 'chunks')
console.log(`[anti-inlining] raiz do standalone: ${raizes[0]}`)
function arquivos(dir) {
  if (!existsSync(dir)) {
    
    console.error(`[anti-inlining] FALHOU: não achei ${dir} — o layout do build mudou?`)
    process.exit(1)
  }
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.js') ? [p] : []
  })
}
const ler = (f) => ({ f, txt: readFileSync(f, 'utf8') })
const servidor = arquivos(RAIZ_SERVIDOR).map(ler)
const conteudo = [...servidor, ...arquivos(RAIZ_CLIENTE).map(ler)]
console.log(`[anti-inlining] varrendo ${servidor.length} chunk(s) de server + ${conteudo.length - servidor.length} de cliente…`)
















const PISO_CHUNKS_SERVIDOR = 40
if (servidor.length < PISO_CHUNKS_SERVIDOR) {
  console.error(
    `[anti-inlining] FALHOU: só ${servidor.length} chunk(s) de server em ${RAIZ_SERVIDOR} ` +
      `(o piso é ${PISO_CHUNKS_SERVIDOR}). Varrer quase nada e passar é o mesmo que não varrer. ` +
      'Rode `rm -rf .next` e builde de novo; se o build está inteiro e o número caiu de verdade, ' +
      'é o Next que mudou o agrupamento de chunks — baixe o piso NO COMMIT que constatar isso.',
  )
  process.exit(1)
}


const assados = conteudo.filter((c) => c.txt.includes(VENENO_REF))



const REF_REAL = /https:\/\/[a-z]{20}\.supabase\.co/
const JWT = /eyJ[\w-]{10,}\.eyJ[\w-]{10,}\./
const literais = conteudo.filter((c) => REF_REAL.test(c.txt) || JWT.test(c.txt))







const DINAMICOS = ['.SUPABASE_URL', 'process.env.SUPABASE_ANON_KEY', 'process.env.SUPABASE_SERVICE_ROLE_KEY']
const sumidos = DINAMICOS.filter((leitura) => !servidor.some((c) => c.txt.includes(leitura)))

const erros = []
if (assados.length) erros.push(`veneno assado em: ${assados.map((c) => c.f).join(', ')}`)
if (literais.length) erros.push(`credencial literal em: ${literais.map((c) => c.f).join(', ')}`)
if (sumidos.length) erros.push(`leitura dinâmica sumiu do bundle (constant-folded?): ${sumidos.join(', ')}`)

if (erros.length) {
  console.error('[anti-inlining] FALHOU:\n- ' + erros.join('\n- '))
  process.exit(1)
}
console.log('[anti-inlining] OK — nada assado, leitura dinâmica preservada.')
