'use client'










import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { PULSO, type DesfechoDaLeitura } from '@/lib/canais/conexao-inbox'
import { criarSupervisor } from '@/lib/canais/supervisor-inbox'

const CANAL = 'realtime:inbox'


const ESPERA_MAX_DA_SESSAO_MS = 3_000

export type Assinatura = {
  sb: SupabaseClient
  ch: RealtimeChannel
  desassinar: () => void
}


export function assinar({ supabaseUrl, anonKey, workspaceId, onChange, aoStatus }: {
  supabaseUrl: string
  anonKey: string
  
  workspaceId: string
  onChange: () => void
  
  aoStatus?: (status: string, desassinar: () => void) => void
}): Assinatura {
  
  
  
  
  const sb = createBrowserClient(supabaseUrl, anonKey)

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const filtroDoWorkspace = `workspace_id=eq.${workspaceId}`

  const ch = sb
    .channel(CANAL)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: filtroDoWorkspace }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagens', filter: filtroDoWorkspace }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversas', filter: filtroDoWorkspace }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversas', filter: filtroDoWorkspace }, onChange)

  
  
  let cancelado = false
  const assinatura: Assinatura = {
    sb,
    ch,
    desassinar: () => {
      cancelado = true
      try {
        sb.removeChannel(ch)
      } catch {
        
      }
    },
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  void (async () => {
    try {
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      await Promise.race([
        sb.realtime.setAuth(),
        new Promise((r) => setTimeout(r, ESPERA_MAX_DA_SESSAO_MS)),
      ])
    } catch {
      
    }
    
    
    
    if (cancelado) return
    try {
      ch.subscribe((status) => aoStatus?.(status, assinatura.desassinar))
    } catch {
      
      
      
      
      
      aoStatus?.('CHANNEL_ERROR', assinatura.desassinar)
    }
  })()

  return assinatura
}


export function useCanalRealtime({
  supabaseUrl,
  anonKey,
  workspaceId,
  reconciliar,
}: {
  supabaseUrl: string
  anonKey: string
  
  workspaceId: string
  
  reconciliar: () => Promise<DesfechoDaLeitura>
}): { aviso: string | null } {
  const [aviso, setAviso] = useState<string | null>(null)
  const reconciliarRef = useRef(reconciliar)
  useEffect(() => {
    reconciliarRef.current = reconciliar
  }, [reconciliar])

  useEffect(() => {
    const supervisor = criarSupervisor({
      assinar: ({ onChange, aoStatus }) =>
        assinar({ supabaseUrl, anonKey, workspaceId, onChange, aoStatus }),
      agendar: (fn, ms) => {
        const t = setTimeout(fn, ms)
        return () => clearTimeout(t)
      },
      agora: () => Date.now(),
      
      
      estaVisivel: () => document.visibilityState !== 'hidden',
      reconciliar: () => reconciliarRef.current(),
      aoAviso: setAviso,
    })

    const relogio = setInterval(() => supervisor.pulsar(), PULSO)
    
    
    
    const aoVoltar = () => supervisor.aoVoltarAOlhar()
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      clearInterval(relogio)
      document.removeEventListener('visibilitychange', aoVoltar)
      supervisor.parar()
    }
  }, [supabaseUrl, anonKey, workspaceId])

  return { aviso }
}

