import 'server-only'
import { mensagemSegura } from '@/lib/sanitizar-erro'
import { criarOrcamento, type Orcamento } from '@/lib/orcamento-tick'
import { rodarTarefas } from '@/server/custom/tarefas'
import { drenarEventosCustom } from '@/server/custom/eventos'
import { lerConfig, gravarConfig } from '@/server/configuracoes'
import { criarLembranca } from '@/lib/lembranca'

/** O braço da ZONA no tick: tarefas periódicas e ganchos de evento do comprador.
 *
 *  🔴 NUNCA LANÇA — e aqui isso vale mais do que nos outros braços. Este é o único que roda
 *  código que NÓS não escrevemos, e ele é o último da fila: automação, egress de webhook e
 *  licença já rodaram. Se lançasse, derrubaria a resposta do tick depois de o trabalho dos
 *  outros três já ter sido feito, e o heartbeat registraria "tick não-ok" para sempre.
 *  Erro vira dado no resumo, no modelo exato de `tickAutomacao()`. */

export const CHAVE_PORTEIRO = 'custom_eventos_ativos'

/** De quanto em quanto tempo a batida do porteiro e renovada. Bem abaixo da janela de 1h que
 *  o `zona_eventos_ativa()` da 0032 exige: a folga cobre um tick atrasado sem fechar a fila
 *  por engano, e ainda assim so escreve no banco 4x por hora em vez de 120x. */
export const RENOVAR_A_CADA_S = 15 * 60

/** O porteiro lembrado em memória de processo.
 *
 *  🔴 ERA UMA LEITURA DE `settings` EM TODA BATIDA — 2.880 por dia com o heartbeat de 30 s —
 *  para descobrir um valor que este mesmo processo é quem escreve, e que muda no máximo a cada
 *  `RENOVAR_A_CADA_S`. Foi o ponto 1 do relato `b41f62e3`, medido no log do Supabase de quem
 *  reportou, e a v0.9.3 cortou os DELETE da poda mas deixou esta leitura. O prazo da lembrança
 *  é a própria janela de renovação (ver `@/lib/lembranca`); gravar renova a lembrança, então com
 *  handler no disco o banco é tocado uma vez a cada 15 min, e sem handler, uma leitura a cada
 *  15 min. Uma edição feita por fora (SQL Editor, restauração) chega aqui em até 15 min.
 *
 *  ⚠️ A lembrança só embrulha o leitor PADRÃO: quem injeta `lerPorteiro`/`gravarPorteiro`
 *  (os testes da decisão) vê cada chamada. */
const porteiroLembrado = criarLembranca<string | null>()

/** Joga fora o porteiro lembrado. Para testes. */
export function esquecerPorteiro(): void {
  porteiroLembrado.esquecer()
}

export type DepsTickCustom = {
  /** Existe algum handler em `custom/eventos/`? */
  temHandlers?: () => Promise<boolean>
  lerPorteiro?: () => Promise<string | null>
  gravarPorteiro?: (valor: string) => Promise<void>
  agora?: () => number
  tarefas?: typeof rodarTarefas
  eventos?: typeof drenarEventosCustom
}

/** ⚠️ O PRIMEIRO PARAMETRO ERA O INSTANTE DO COMECO DO TICK (`number`) E VIROU O ORCAMENTO
 *  COMPARTILHADO. Este braco era o UNICO do tick com prazo derivado — os outros sete tinham
 *  portao de entrada ou nada —, e a conta dele (`min(20s, 45s − decorrido)`) e a que virou a
 *  janela de todo mundo. O que ele passa adiante continua sendo o instante, porque e disso que
 *  `orcamentoRestante` precisa; o que mudou e de onde a janela sai. */
export async function tickCustom(
  orcamento: Orcamento = criarOrcamento(Date.now()),
  deps: DepsTickCustom = {},
): Promise<Record<string, unknown>> {
  const comecoDoTick = orcamento.comecoMs
  const resumo: Record<string, unknown> = {}

  // 1. O porteiro. A trigger do banco só enfileira quando este `settings` está ligado — sem
  //    isso, `eventos_custom` acumularia em TODO deploy que nunca escreveu um handler, que é
  //    exatamente o bug que a 0020 consertou na fila do webhook. Quem sabe se há handler é o
  //    disco, e quem enxerga o disco é o servidor: por isso a sincronia mora aqui.
  //    Grava só quando MUDA — isto roda a cada ~30s.
  try {
    const agoraMs = (deps.agora ?? Date.now)()
    const agora = Math.floor(agoraMs / 1000)
    const atual = await (deps.lerPorteiro
      ? deps.lerPorteiro()
      : porteiroLembrado.ler(agoraMs, () => lerConfig(CHAVE_PORTEIRO)))
    const gravar =
      deps.gravarPorteiro ??
      (async (v: string) => {
        await gravarConfig(CHAVE_PORTEIRO, v)
        // Só DEPOIS de gravar: um upsert que falhou não pode deixar a memória dizendo que
        // o porteiro está renovado enquanto o banco diz o contrário.
        porteiroLembrado.lembrar(v, agoraMs)
      })

    if (await (deps.temHandlers ?? temHandlersNoDisco)()) {
      // Renova a batida só quando ela está velha. Isto roda a cada ~30s: renovar sempre seria
      // um `upsert` por tick, para sempre, sem nada mudar.
      const ultimo = atual && /^\d+$/.test(atual) ? Number(atual) : 0
      if (agora - ultimo >= RENOVAR_A_CADA_S) {
        await gravar(String(agora))
        resumo.porteiro = 'renovado'
      }
    } else if (atual !== '0') {
      // Último handler apagado: fecha na hora, sem esperar a janela expirar.
      await gravar('0')
      resumo.porteiro = 'desligado'
    }
  } catch (e) {
    resumo.erroPorteiro = msg(e)
  }

  try {
    resumo.tarefas = await (deps.tarefas ?? rodarTarefas)({ comecoDoTick })
  } catch (e) {
    resumo.erroTarefas = msg(e)
  }

  try {
    resumo.eventos = await (deps.eventos ?? drenarEventosCustom)({ comecoDoTick })
  } catch (e) {
    resumo.erroEventos = msg(e)
  }

  return resumo
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

async function temHandlersNoDisco(): Promise<boolean> {
  const { readdir } = await import('node:fs/promises')
  const nomes = await readdir('custom/eventos').catch(() => [] as string[])
  return nomes.some((n) => n.endsWith('.ts'))
}
