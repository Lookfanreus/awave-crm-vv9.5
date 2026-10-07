import 'server-only'
import { mensagemSegura } from '@/lib/sanitizar-erro'
import { ehModuloAusente } from '@/lib/zona-custom'
import { arquivoDoEvento, orcamentoRestante, TETO_POR_TAREFA_MS } from '@/lib/tarefa-custom'
import { backoff } from '@/server/webhook/nucleo'
import { lerConfig, gravarConfig } from '@/server/configuracoes'
import { deveExpurgar } from '@/server/canais/expurgo'
import { criarLembranca } from '@/lib/lembranca'

/** Drena `eventos_custom` para os handlers em `custom/eventos/<evento>.ts`.
 *
 *  Espelha `webhook/entrega.ts` de propósito — reserva por RPC com claim atômico, backoff em
 *  degraus, desistência no teto —, mas em fila PRÓPRIA: a do webhook só recebe evento de
 *  workspace com destino ativo (0020), então um handler pendurado nela veria zero em qualquer
 *  instalação sem o upsell de IA.
 *
 *  🔴 NUNCA LANÇA. Roda no tick, depois do egress.
 *  🔴 NÃO HÁ SESSÃO. O `workspaceId` vem do EVENTO, e é ele que o handler tem que usar no
 *  filtro quando escrever no banco com `clienteSemIsolamento()`. */

/** Igual ao do egress: 8 tentativas com a mesma curva. Duas curvas diferentes para o mesmo
 *  tipo de falha só produziriam duas explicações para dar ao comprador. */
export const MAX_TENTATIVAS = 8

/** Teto de linhas por tick. O mesmo do egress, e pelo mesmo motivo: a fila é drenada em
 *  lotes para não competir com o resto do tick. */
export const LOTE = 20

/** Quantos dias uma linha ja resolvida fica na fila antes de ser podada. Curto de proposito:
 *  esta tabela nao e historico, e ninguem no produto a le. */
export const DIAS_DE_RETENCAO = 3

export type LinhaEventoCustom = {
  id: string
  tipo: string
  workspace_id: string
  payload: unknown
  criado_em: string
  tentativas: number
}

export type DepsEventos = {
  reservar?: (limite: number) => Promise<LinhaEventoCustom[]>
  carregar?: (arquivo: string) => Promise<{ default?: unknown }>
  marcarProcessado?: (id: string) => Promise<void>
  marcarFalha?: (id: string, tentativas: number, erro: string, desistir: boolean) => Promise<void>
  agora?: () => number
  comecoDoTick?: number
  tetoPorEventoMs?: number
  podar?: () => Promise<void>
  /** A marca da última poda. Injetável porque a decisão de podar é o que o teste mede, e
   *  mockar o `settings` inteiro faria o caso provar o mock, não a regra. */
  lerUltimaPoda?: () => Promise<string | null>
  gravarUltimaPoda?: (iso: string) => Promise<void>
}

/** A marca da última poda da fila da zona custom, no `settings`. Espelha o
 *  `CHAVE_ULTIMO_EXPURGO` do expurgo do produto — mesma ideia, fila diferente. */
export const CHAVE_ULTIMA_PODA = 'custom_poda_ultima_em'

/** A marca da última poda lembrada em memória de processo.
 *
 *  🔴 A TRAVA DA v0.9.3 TROCOU DOIS DELETE POR BATIDA POR UMA LEITURA POR BATIDA: para decidir
 *  que "não é hora de podar" ela lia `settings` a cada passada do heartbeat — 2.880 leituras por
 *  dia para quase sempre concluir que faltavam 23 h. Quem relatou mede o log do Supabase dele,
 *  e por requisição uma leitura custa o mesmo que um DELETE vazio. A marca é lembrada por
 *  `PRAZO_DA_LEMBRANCA_MS` (ver `@/lib/lembranca`) e renovada quando este processo a grava.
 *
 *  ⚠️ Só embrulha o leitor PADRÃO: quem injeta `lerUltimaPoda` (os testes da decisão) vê cada
 *  chamada. */
const ultimaPodaLembrada = criarLembranca<string | null>()

/** Joga fora a marca lembrada. Para testes. */
export function esquecerUltimaPoda(): void {
  ultimaPodaLembrada.esquecer()
}

export async function drenarEventosCustom(deps: DepsEventos = {}): Promise<Record<string, unknown>> {
  const agora = deps.agora ?? (() => Date.now())
  const teto = deps.tetoPorEventoMs ?? TETO_POR_TAREFA_MS
  const comeco = deps.comecoDoTick ?? agora()

  const resumo: Record<string, unknown> = { processados: 0, semDono: 0, falhas: 0, descartados: 0 }

  let orcamento = orcamentoRestante(comeco, agora())
  if (orcamento <= 0) {
    resumo.pulado = 'sem folga no tick'
    return resumo
  }

  // 🔴 PODA. Sem ela a fila cresce para sempre: quem escreve UM handler recebe os outros seis
  // tipos, cada um marcado `processado_em` e deixado na tabela — uma linha por contato, por
  // negócio e por mudança de etapa, indefinidamente. É a dívida que a `0020` pagou na fila do
  // webhook, voltando com outra granularidade. Best-effort: falhar em podar não pode impedir
  // o dreno, que é o trabalho de verdade.
  //
  // 🔴 UMA VEZ POR DIA, NÃO A CADA BATIDA. Antes a poda rodava em toda passada do heartbeat, e
  // ela dispara dois DELETE: com o intervalo padrão de 30 s isso dava **5.758 DELETEs por dia**,
  // dos quais ~2.878 não tinham nada para apagar. Num deploy que nunca escreveu handler nenhum —
  // o caso de quase todo comprador — o trabalho inteiro era desperdiçado. Medido por quem
  // reportou, numa auditoria de 24 h dos logs do Supabase depois de estourar a cota do plano
  // gratuito.
  //
  // A trava não é regra nova: é o `deveExpurgar` + `INTERVALO_EXPURGO_MS` que o expurgo DO
  // PRODUTO já usava dois arquivos ao lado. Ele também é quem trata marca ilegível ou no FUTURO
  // (relógio mexido, restauração de backup) devolvendo `true` — deixar de podar por causa de um
  // carimbo estranho faria a fila crescer para sempre, que é o que a poda existe para impedir.
  try {
    const ultima = await (deps.lerUltimaPoda
      ? deps.lerUltimaPoda()
      : ultimaPodaLembrada.ler(agora(), () => lerConfig(CHAVE_ULTIMA_PODA)))
    if (deveExpurgar(ultima, agora())) {
      await (deps.podar ?? podarPadrao)()
      // A marca só é gravada DEPOIS de a poda ter dado certo: carimbar antes faria um erro
      // comprar 24 h de silêncio, e a fila voltaria a crescer sem ninguém ver. E a memória só
      // é atualizada DEPOIS de gravar, pela mesma razão.
      const gravar =
        deps.gravarUltimaPoda ??
        (async (iso: string) => {
          await gravarConfig(CHAVE_ULTIMA_PODA, iso)
          ultimaPodaLembrada.lembrar(iso, agora())
        })
      await gravar(new Date(agora()).toISOString())
    }
  } catch (e) {
    resumo.erroPoda = msg(e)
  }

  let linhas: LinhaEventoCustom[]
  try {
    linhas = (await (deps.reservar ?? reservarPadrao)(LOTE)) ?? []
  } catch (e) {
    resumo.erro = msg(e)
    return resumo
  }

  for (const linha of linhas) {
    if (orcamento <= 0) {
      resumo.adiados = ((resumo.adiados as number) ?? 0) + 1
      continue
    }
    const inicio = agora()

    // O `tipo` vem do BANCO. Uma linha inserida à mão não pode virar caminho de `import()`.
    const arquivo = arquivoDoEvento(linha.tipo)

    try {
      // DENTRO do try: o `continue` daqui precisa passar pelo `finally` que desconta o
      // orçamento — senão esta é a única saída do laço que não paga pelo tempo que gastou.
      if (!arquivo) {
        await marcar(deps, linha.id, resumo, 'descartados')
        continue
      }
      let mod: { default?: unknown }
      try {
        mod = await (deps.carregar ?? carregarPadrao)(arquivo)
      } catch (err) {
        // Sem handler para este tipo é o caso NORMAL — são SETE tipos (a `0020` acrescentou
        // `lead_excluido` e `deal_excluido`), e quem escreve um handler recebe os outros seis
        // na fila. Tratar como falha encheria a fila de linha eterna e gastaria oito
        // tentativas com backoff em evento que ninguém quer.
        if (ehModuloAusente(err)) {
          await marcar(deps, linha.id, resumo, 'semDono')
          continue
        }
        throw err // arquivo existe e quebra na carga: isso É falha do comprador
      }

      const handler = mod?.default
      if (typeof handler !== 'function') {
        await marcar(deps, linha.id, resumo, 'semDono')
        continue
      }

      await comTimeout(
        () => (handler as (e: unknown) => Promise<unknown>)({
          tipo: linha.tipo,
          workspaceId: linha.workspace_id,
          payload: linha.payload,
        }),
        Math.min(teto, orcamento),
      )
      await (deps.marcarProcessado ?? marcarProcessadoPadrao)(linha.id)
      resumo.processados = (resumo.processados as number) + 1
    } catch (e) {
      const tentativas = linha.tentativas + 1
      // O `ultimo_erro` vai para uma linha de `eventos_custom`, que tem RLS de service_role e
      // nenhum leitor no produto — ou seja, o comprador não alcança. O log do container é o
      // único canal que ele tem, e é o que o `custom/eventos/LEIA-ME.md` promete.
      console.error('[custom/evento] falhou:', linha.tipo, `tentativa ${tentativas}`, msg(e))
      try {
        await (deps.marcarFalha ?? marcarFalhaPadrao)(linha.id, tentativas, msg(e), tentativas >= MAX_TENTATIVAS)
      } catch {
        // `.catch()` só pega rejeição; um dep que lance SÍNCRONO escaparia do `finally` e
        // furaria o "NUNCA LANÇA" escrito no topo deste arquivo.
      }
      resumo.falhas = (resumo.falhas as number) + 1
    } finally {
      orcamento -= Math.max(0, agora() - inicio)
    }
  }

  return resumo
}

async function marcar(
  deps: DepsEventos,
  id: string,
  resumo: Record<string, unknown>,
  contador: 'semDono' | 'descartados',
): Promise<void> {
  try {
    await (deps.marcarProcessado ?? marcarProcessadoPadrao)(id)
  } catch {
    // `.catch()` só pega rejeição; dep que lance síncrono escaparia daqui.
  }
  resumo[contador] = ((resumo[contador] as number) ?? 0) + 1
}

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

async function carregarPadrao(arquivo: string): Promise<{ default?: unknown }> {
  // Extensão no padrão: sem ela o contexto do bundler engole o LEIA-ME.md e o build de TODO
  // comprador quebra (medido na Fatia A).
  return import(/* turbopackOptional: true */ `@custom/eventos/${arquivo}.ts`)
}

async function reservarPadrao(limite: number): Promise<LinhaEventoCustom[]> {
  const { admin } = await import('@/server/supabase')
  const { data, error } = await admin().rpc('reservar_eventos_custom', { p_limite: limite })
  if (error) throw error
  return (data ?? []) as LinhaEventoCustom[]
}

async function marcarProcessadoPadrao(id: string): Promise<void> {
  const { admin } = await import('@/server/supabase')
  await admin().from('eventos_custom').update({ processado_em: new Date().toISOString() }).eq('id', id)
}

async function marcarFalhaPadrao(id: string, tentativas: number, erro: string, desistir: boolean): Promise<void> {
  const { admin } = await import('@/server/supabase')
  const patch: Record<string, unknown> = {
    tentativas,
    ultimo_erro: erro.slice(0, 500),
    proxima_tentativa: new Date(Date.now() + backoff(tentativas)).toISOString(),
  }
  if (desistir) patch.desistido_em = new Date().toISOString()
  await admin().from('eventos_custom').update(patch).eq('id', id)
}

/** Apaga o que ja foi resolvido ha mais de DIAS_DE_RETENCAO dias — processados, descartados e
 *  desistidos. O que ainda esta pendente nunca e tocado. */
async function podarPadrao(): Promise<void> {
  const { admin } = await import('@/server/supabase')
  const corte = new Date(Date.now() - DIAS_DE_RETENCAO * 24 * 60 * 60 * 1000).toISOString()
  await admin().from('eventos_custom').delete().lt('criado_em', corte).not('processado_em', 'is', null)
  await admin().from('eventos_custom').delete().lt('criado_em', corte).not('desistido_em', 'is', null)
}
