import 'server-only'
import { admin } from './supabase'
import { mensagemSegura } from '@/lib/sanitizar-erro'




const JANELA_MS = 60_000


const TETO_DE_NOMES = 200


let relogio: () => number = Date.now


const ultimaLinha = new Map<string, { em: number; suprimidas: number }>()


export function reiniciarThrottleDoVault(agora: () => number = Date.now): void {
  relogio = agora
  ultimaLinha.clear()
}


function textoDoErro(erro: unknown, valor?: string): string {
  const bruto =
    erro && typeof erro === 'object' && 'message' in erro
      ? String((erro as { message: unknown }).message)
      : String(erro)
  const limpo = mensagemSegura(bruto)
  
  
  
  return valor && valor.length >= 8 ? limpo.split(valor).join('***') : limpo
}


function registrarFalha(
  operacao: 'get_secret' | 'set_secret' | 'delete_secret',
  nome: string,
  erro: unknown,
  valor?: string,
): void {
  const agora = relogio()
  const anterior = ultimaLinha.get(nome)
  if (anterior && agora - anterior.em < JANELA_MS) {
    anterior.suprimidas++
    return
  }

  if (ultimaLinha.size >= TETO_DE_NOMES) ultimaLinha.clear()
  ultimaLinha.set(nome, { em: agora, suprimidas: 0 })

  
  
  
  const engolidas = anterior?.suprimidas ?? 0
  const sufixo = engolidas > 0 ? ` (+${engolidas} suprimida(s) desde a ultima linha)` : ''
  console.error(`[vault] ${operacao} falhou: ${nome}${sufixo}`, textoDoErro(erro, valor))
}

export async function getSecret(nome: string): Promise<string | null> {
  const { data, error } = await admin().rpc('get_secret', { p_name: nome })
  const valor = (data as string | null) ?? null
  
  
  
  if (error) registrarFalha('get_secret', nome, error, valor ?? undefined)
  return valor
}


export async function setSecret(nome: string, valor: string): Promise<boolean> {
  const { error } = await admin().rpc('set_secret', { p_name: nome, p_value: valor })
  
  
  if (error) registrarFalha('set_secret', nome, error, valor)
  return !error
}


export async function deleteSecret(nome: string): Promise<void> {
  const { error } = await admin().rpc('delete_secret', { p_name: nome })
  if (error) registrarFalha('delete_secret', nome, error)
}
