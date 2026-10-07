















export const PAGINA_CONVERSAS = 30


export const PAGINA_MENSAGENS = 50


type Conversa = { id: string; ultimaMensagemEm: string | null }


type Mensagem = { id: string; origemEm: string }


export type EstadoDaLista = { pagina: number; temMais: boolean }


export type DesfechoDaPagina = { ok: true; paginaPedida: number; recebidas: number } | { ok: false }


export function listaApos(estado: EstadoDaLista, desfecho: DesfechoDaPagina): EstadoDaLista {
  if (!desfecho.ok) return estado
  return { pagina: desfecho.paginaPedida, temMais: desfecho.recebidas >= PAGINA_CONVERSAS }
}


export function listaInicial(recebidas: number): EstadoDaLista {
  return { pagina: 0, temMais: recebidas >= PAGINA_CONVERSAS }
}


export function proximaPaginaDaLista(estado: EstadoDaLista): number | null {
  return estado.temMais ? estado.pagina + 1 : null
}


function relogio(c: Conversa): number {
  if (c.ultimaMensagemEm === null) return -Infinity
  const ms = Date.parse(c.ultimaMensagemEm)
  
  
  return Number.isNaN(ms) ? -Infinity : ms
}


function ordemDaLista(a: Conversa, b: Conversa): number {
  const ra = relogio(a)
  const rb = relogio(b)
  if (ra !== rb) return rb - ra
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}


function unir<T extends { id: string }>(atuais: T[], novas: T[]): T[] {
  const porId = new Map<string, T>()
  for (const c of atuais) porId.set(c.id, c)
  for (const c of novas) porId.set(c.id, c)
  return [...porId.values()]
}


export function mesclarPaginaDeConversas<T extends Conversa>(atuais: T[], novas: T[]): T[] {
  return unir(atuais, novas).sort(ordemDaLista)
}


export function mesclarTopoDaLista<T extends Conversa>(
  atuais: T[],
  frescas: T[],
  { paginaCheia }: { paginaCheia: boolean },
): T[] {
  const idsFrescos = new Set(frescas.map((c) => c.id))
  if (!paginaCheia) {
    return unir(
      atuais.filter((c) => idsFrescos.has(c.id)),
      frescas,
    ).sort(ordemDaLista)
  }
  const ultima = frescas[frescas.length - 1]
  const piso = ultima ? relogio(ultima) : Infinity
  const sobreviventes = atuais.filter((c) => idsFrescos.has(c.id) || relogio(c) <= piso)
  return unir(sobreviventes, frescas).sort(ordemDaLista)
}


export function semAConversa<T extends { id: string }>(atuais: T[], id: string): T[] {
  return atuais.filter((c) => c.id !== id)
}




export type EstadoDaThread = { temAnteriores: boolean }


export type DesfechoDaThread =
  | { ok: true; recebidas: number; novas: number }
  | { ok: false }


export function threadApos(estado: EstadoDaThread, desfecho: DesfechoDaThread): EstadoDaThread {
  if (!desfecho.ok) return estado
  return { temAnteriores: desfecho.recebidas >= PAGINA_MENSAGENS && desfecho.novas > 0 }
}


export function threadInicial(recebidas: number): EstadoDaThread {
  return { temAnteriores: recebidas >= PAGINA_MENSAGENS }
}


export function cursorDeAnteriores<T extends Mensagem>(mensagens: T[]): string | null {
  let corte: string | null = null
  let menor = Infinity
  for (const m of mensagens) {
    const ms = Date.parse(m.origemEm)
    if (Number.isNaN(ms)) continue
    if (ms < menor) {
      menor = ms
      corte = m.origemEm
    }
  }
  return corte
}


function ordemDaThread(a: Mensagem, b: Mensagem): number {
  const ta = Date.parse(a.origemEm)
  const tb = Date.parse(b.origemEm)
  const na = Number.isNaN(ta)
  const nb = Number.isNaN(tb)
  if (na || nb) return na && nb ? 0 : na ? 1 : -1
  if (ta !== tb) return ta - tb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}


export function mesclarMensagens<T extends Mensagem>(atuais: T[], outras: T[]): T[] {
  return unir(atuais, outras).sort(ordemDaThread)
}


export function quantasNovas<T extends { id: string }>(atuais: T[], chegando: T[]): number {
  const conhecidos = new Set(atuais.map((x) => x.id))
  let n = 0
  for (const x of chegando) {
    if (conhecidos.has(x.id)) continue
    conhecidos.add(x.id)
    n += 1
  }
  return n
}




export type Faixa = { controle: boolean; erro: string | null; fim: boolean }


export function faixaDePaginacao(e: {
  
  podeCarregar: boolean
  erro: string | null
  
  jaPediu: boolean
  vazia: boolean
}): Faixa {
  return {
    controle: e.podeCarregar,
    erro: e.podeCarregar ? e.erro : null,
    fim: !e.podeCarregar && e.jaPediu && !e.vazia,
  }
}
