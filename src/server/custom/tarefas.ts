import 'server-only'
import { mensagemSegura } from '@/lib/sanitizar-erro'
import { ehSegmentoValido } from '@/lib/zona-custom'
import {
  intervaloEmMs,
  deveRodar,
  orcamentoRestante,
  TETO_POR_TAREFA_MS,
} from '@/lib/tarefa-custom'

/** Roda `custom/tarefas/<nome>.ts` no tick — a superfície da zona que funciona sem ninguém
 *  na tela (sincronização noturna, agente de IA que trabalha sozinho).
 *
 *  🔴 NUNCA LANÇA. Roda no `/api/interno/tick`, que também drena o egress de webhook (em
 *  produção) e bate a licença. Erro do comprador vira dado no resumo, nunca exceção.
 *
 *  🔴 NÃO HÁ SESSÃO AQUI. O caminho de banco da tarefa é `clienteSemIsolamento()`, e o filtro
 *  por espaço de trabalho é responsabilidade de quem a escreveu — está no LEIA-ME da pasta.
 *
 *  Tudo entra por injeção (`deps`) porque é o que torna isto testável sem disco, sem bundler
 *  e sem relógio real — mesmo padrão que `resolverWorkspaceAtivo` já usa neste repo. */

export type DepsTarefas = {
  /** Os nomes das tarefas no disco (sem extensão). */
  listar?: () => Promise<string[]>
  carregar?: (nome: string) => Promise<{ default?: unknown; cada?: unknown }>
  lerMarca?: (chave: string) => Promise<string | null>
  gravarMarca?: (chave: string, valor: string) => Promise<void>
  agora?: () => number
  /** Instante em que o tick começou — é dele que sai o orçamento. */
  comecoDoTick?: number
  tetoPorTarefaMs?: number
}

const CHAVE = (nome: string) => `custom_tarefa_${nome}`

export async function rodarTarefas(deps: DepsTarefas = {}): Promise<Record<string, unknown>> {
  const agora = deps.agora ?? (() => Date.now())
  const teto = deps.tetoPorTarefaMs ?? TETO_POR_TAREFA_MS
  const comeco = deps.comecoDoTick ?? agora()

  const resumo: Record<string, unknown> = { rodadas: 0, erros: [] as Array<{ tarefa: string; erro: string }> }
  const erros = resumo.erros as Array<{ tarefa: string; erro: string }>

  let orcamento = orcamentoRestante(comeco, agora())
  if (orcamento <= 0) {
    // O tick já gastou o que tinha. A tarefa espera a próxima volta — é o que uma fila faz,
    // e é melhor que roubar o tempo de quem roda antes (egress, licença).
    resumo.pulado = 'sem folga no tick'
    return resumo
  }

  let nomes: string[]
  try {
    nomes = (await (deps.listar ?? listarDoDisco)()) ?? []
  } catch (e) {
    resumo.erro = msg(e)
    return resumo
  }

  for (const nome of nomes) {
    // O nome vem do DISCO, mas vira caminho de import: mesmo saneamento das outras superfícies.
    if (!ehSegmentoValido(nome)) continue
    if (orcamento <= 0) {
      resumo.adiadas = ((resumo.adiadas as number) ?? 0) + 1
      continue
    }

    const inicio = agora()
    // 🔴 A MARCA SÓ É GRAVADA QUANDO HOUVE TENTATIVA — e este flag é a diferença entre a
    // tarefa funcionar e a superfície inteira estar morta.
    //
    // O bug (corrigido em 2026-08-15, achado em revisão): a gravação estava no `finally`, e
    // `continue` dentro de `try` EXECUTA o `finally`. Então o caminho "não está na hora"
    // reescrevia a marca com `agora()` a cada tick. Como o tick bate a cada ~30s e o piso de
    // intervalo é 60s, a marca era sempre empurrada para frente antes de o intervalo vencer:
    // a tarefa rodava UMA vez, no primeiro tick depois do deploy, e nunca mais — sem erro,
    // sem log, e sem recuperação a não ser redeployando.
    let tentou = false
    try {
      const mod = await (deps.carregar ?? carregarDoDisco)(nome)
      const rodar = mod?.default
      if (typeof rodar !== 'function') continue // não é tarefa: não marca nada

      const marca = await (deps.lerMarca ?? lerMarcaPadrao)(CHAVE(nome))
      const ultimo = marca === null ? null : Number(marca)
      if (!deveRodar(ultimo, intervaloEmMs(mod.cada), agora())) continue // ainda não venceu

      tentou = true
      // O teto individual nao pode passar da folga que resta: com 1ms de orcamento uma
      // tarefa ainda queimaria 10s inteiros, e a margem de 15s ate o abort de 60s do
      // heartbeat viraria 5s. Clampar aqui e o que faz a conta declarada ser a conta real.
      await comTimeout(rodar as () => Promise<unknown>, Math.min(teto, orcamento))
      resumo.rodadas = (resumo.rodadas as number) + 1
    } catch (e) {
      // Erro conta como tentativa — inclusive falha ao CARREGAR o módulo. Sem isso, uma
      // tarefa que sempre quebra seria retentada a cada ~30s para sempre, comendo o orçamento
      // do braço e empurrando as outras para fora: uma falha vira duas.
      tentou = true
      erros.push({ tarefa: nome, erro: msg(e) })
      // O comprador precisa de ALGUM lugar onde ler isto. O corpo da resposta do tick é
      // descartado pelo `heartbeat-tick.mjs` (ele só olha o status), então o log do
      // container é o único canal — e é o que o `custom/tarefas/LEIA-ME.md` promete.
      console.error('[custom/tarefa] falhou:', nome, msg(e))
    } finally {
      if (tentou) {
        try {
          await (deps.gravarMarca ?? gravarMarcaPadrao)(CHAVE(nome), String(agora()))
        } catch {
          // Marca não gravada só faz a tarefa rodar de novo no próximo tick. Nunca lança:
          // este módulo roda dentro do tick que também drena o egress.
        }
      }
      orcamento -= Math.max(0, agora() - inicio)
    }
  }

  return resumo
}

/** `Promise.race` com o timer limpo no fim.
 *
 *  ⚠️ Isto ABANDONA a espera, não mata o trabalho: um `fetch` sem timeout do comprador segue
 *  ocupando o processo. Matar de verdade exigiria outro processo — fora de escopo, e o
 *  LEIA-ME da pasta manda usar `AbortSignal.timeout()`. */
async function comTimeout(fn: () => Promise<unknown>, ms: number): Promise<void> {
  let t: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`tempo esgotado (${ms}ms)`)), ms) }),
    ])
  } finally {
    if (t) clearTimeout(t)
  }
}

/** O texto do erro para o resumo do tick e para as colunas que o guardam.
 *
 *  🔴 `mensagemSegura`, e nao a textualizacao a mao que morava aqui
 *  (`e instanceof Error ? e.message : String(e)`). Aquela linha e a implementacao que
 *  `mensagemSegura` substituiu, e reintroduzia as DUAS coisas que ela conserta: o erro do
 *  PostgREST e objeto simples, nao passa no `instanceof`, caia no `String(e)` e virava
 *  `"[object Object]"`; e nada era redigido — a connection string do cliente de servico e o
 *  JWT que este processo carrega passavam inteiros para o log e para o banco. */
function msg(e: unknown): string {
  return mensagemSegura(e)
}

async function listarDoDisco(): Promise<string[]> {
  const { readdir } = await import('node:fs/promises')
  const nomes = await readdir('custom/tarefas').catch(() => [] as string[])
  return nomes.filter((n) => n.endsWith('.ts')).map((n) => n.slice(0, -3))
}

async function carregarDoDisco(nome: string): Promise<{ default?: unknown; cada?: unknown }> {
  // Extensão no padrão: sem ela o módulo de contexto do bundler engole o LEIA-ME.md da pasta
  // e o build de TODO comprador quebra (medido na Fatia A).
  return import(/* turbopackOptional: true */ `@custom/tarefas/${nome}.ts`)
}

async function lerMarcaPadrao(chave: string): Promise<string | null> {
  const { lerConfig } = await import('@/server/configuracoes')
  return lerConfig(chave)
}

async function gravarMarcaPadrao(chave: string, valor: string): Promise<void> {
  const { gravarConfig } = await import('@/server/configuracoes')
  return gravarConfig(chave, valor)
}
