





import 'server-only'
import { admin } from '@/server/supabase'
import { normalizarConfig, type ConfigHorario } from '@/lib/agente/horario-atendimento'


export async function lerHorarioDeAtendimento(ws: string): Promise<ConfigHorario | null> {
  try {
    const { data, error } = await admin()
      .from('horario_atendimento')
      .select('fuso, faixas, feriados')
      .eq('workspace_id', ws)
      .maybeSingle()
    if (error || !data) return null
    return normalizarConfig(data)
  } catch {
    return null
  }
}
