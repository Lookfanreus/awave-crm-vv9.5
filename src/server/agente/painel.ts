
import 'server-only'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { getSecret } from '@/server/secrets'



import { CHAVE_MODELO, CHAVE_OPENAI, MODELO_PADRAO } from '@/server/agente/chaves'
import { lerCustoDoDeploy, temPrecoConhecido, type ResumoDeCusto } from '@/server/agente/custo'
import { PROVIDER_DE_SIMULACAO } from '@/lib/canais/simulacao'
import { contarBlocosExclusivos, contarBlocosVisiveis } from '@/lib/canais/base-conhecimento'




import { getProvider } from '@/server/canais/registry'




import {
  avaliarAtendimento,
  normalizarConfig,
  type Atendimento,
  type ConfigHorario,
} from '@/lib/agente/horario-atendimento'

export type CanalNoPainelDoAgente = {
  id: string
  nome: string
  telefone: string | null
  ligado: boolean
  
  calaAoResponderDeFora: boolean
}


export type AssistenteNoPainel = {
  id: string
  
  nomeInterno: string
  nome: string
  tratamento: 'voce' | 'senhor'
  sobreONegocio: string
  padrao: boolean
  
  canais: Array<{ id: string; nome: string }> | null
  
  blocosVisiveis: number | null
  
  blocosExclusivos: number | null
}

export type PainelDoAgente = {
  
  ehDono: boolean
  
  temChave: boolean
  modelo: string
  
  modeloEhPadrao: boolean
  
  persona: { nome: string; tratamento: 'voce' | 'senhor'; sobreONegocio: string } | null
  
  assistentes: AssistenteNoPainel[]
  
  canais: CanalNoPainelDoAgente[] | null
  
  modeloSemPreco: boolean
  
  custo: ResumoDeCusto | null
  
  horario: ConfigHorario | null
  
  atendimentoAgora: Atendimento
}


export async function lerAssistentesDoWorkspace(
  ws: string,
): Promise<Array<Omit<AssistenteNoPainel, 'canais' | 'blocosVisiveis' | 'blocosExclusivos'>>> {
  
  
  
  
  
  const cliente = await criarClienteServidor()
  const { data, error } = await cliente
    .from('assistentes')
    .select('id, nome_interno, nome, tratamento, sobre_o_negocio, padrao')
    .eq('workspace_id', ws)
    .order('criado_em', { ascending: true })
  if (error) throw new Error('falha ao ler os assistentes deste espaço de trabalho')
  return (
    (data ?? []) as Array<{
      id: string
      nome_interno?: string
      nome?: string
      tratamento?: string
      sobre_o_negocio?: string
      padrao?: boolean | null
    }>
  ).map((a) => ({
    id: a.id,
    nomeInterno: a.nome_interno ?? '',
    nome: a.nome ?? '',
    tratamento: a.tratamento === 'senhor' ? ('senhor' as const) : ('voce' as const),
    sobreONegocio: a.sobre_o_negocio ?? '',
    padrao: Boolean(a.padrao),
  }))
}

export async function lerPainelDoAgente(): Promise<PainelDoAgente> {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  const ehDono = await ehDonoDoDeploy()

  const modeloGravado = (await getSecret(CHAVE_MODELO))?.trim() || null
  const temChave = Boolean((await getSecret(CHAVE_OPENAI))?.trim())

  const vazio: PainelDoAgente = {
    ehDono,
    temChave,
    modelo: modeloGravado ?? MODELO_PADRAO,
    modeloEhPadrao: !modeloGravado,
    modeloSemPreco: !temPrecoConhecido(modeloGravado ?? MODELO_PADRAO),
    persona: null,
    assistentes: [],
    
    
    
    
    
    canais: null,
    custo: null,
    horario: null,
    atendimentoAgora: { estado: 'sem_horario' },
  }
  if (!ws) return vazio

  
  
  
  
  
  
  const db = cliente

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  

  
  
  
  
  
  
  
  
  
  
  
  
  const { data: canaisBrutos, error: erroCanais } = await db
    .from('canais')
    
    
    
    .select('id, nome, telefone, agente_ligado, agente_id, provider')
    .eq('workspace_id', ws)
    .neq('provider', PROVIDER_DE_SIMULACAO)
    .order('criado_em', { ascending: true })

  
  
  
  
  
  const listaDeAssistentes = await lerAssistentesDoWorkspace(ws)

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  let blocosPorAssistente: Record<string, number> | null = null
  let exclusivosPorAssistente: Record<string, number> | null = null
  if (listaDeAssistentes.length > 0) {
    try {
      const { data: blocosBrutos, error: erroBlocos } = await db
        .from('base_conhecimento')
        .select('id')
        .eq('workspace_id', ws)
        .eq('habilitado', true)
      
      
      
      
      
      if (erroBlocos || !blocosBrutos) throw erroBlocos ?? new Error('leitura de blocos habilitados sem dado')
      const idsHabilitados = (blocosBrutos as Array<{ id: string }>).map((b) => b.id)

      
      
      
      
      
      
      let recorteBruto: Array<{ assistente_id: string; bloco_id: string }> = []
      if (idsHabilitados.length > 0) {
        const { data, error: erroRecorte } = await db
          .from('assistente_blocos')
          .select('assistente_id, bloco_id')
          .eq('workspace_id', ws)
          .in('bloco_id', idsHabilitados)
        if (erroRecorte || !data) throw erroRecorte ?? new Error('leitura do recorte sem dado')
        recorteBruto = data as Array<{ assistente_id: string; bloco_id: string }>
      }

      const recorte = recorteBruto.map((r) => ({ assistenteId: r.assistente_id, blocoId: r.bloco_id }))
      const ids = listaDeAssistentes.map((a) => a.id)
      blocosPorAssistente = contarBlocosVisiveis(idsHabilitados, recorte, ids)
      exclusivosPorAssistente = contarBlocosExclusivos(idsHabilitados, recorte, ids)
    } catch {
      
      blocosPorAssistente = null
      exclusivosPorAssistente = null
    }
  }

  
  
  
  
  let horario: ConfigHorario | null = null
  {
    const { data: horarioBruto } = await db
      .from('horario_atendimento')
      .select('fuso, faixas, feriados')
      .eq('workspace_id', ws)
      .maybeSingle()
    horario = horarioBruto ? normalizarConfig(horarioBruto) : null
  }

  
  
  
  let custo: ResumoDeCusto | null = null
  if (ehDono) {
    try {
      custo = await lerCustoDoDeploy()
    } catch {
      
      custo = null
    }
  }

  
  
  
  const p = listaDeAssistentes.find((a) => a.padrao) ?? null

  
  
  
  
  
  
  
  
  
  
  
  
  const linhasDeCanal =
    erroCanais || !canaisBrutos
      ? null
      : (canaisBrutos as Array<{
          id: string
          nome: string
          telefone: string | null
          agente_ligado: boolean | null
          agente_id: string | null
          provider: string
        }>)

  return {
    ...vazio,
    persona: p
      ? 
        
        
        { nome: p.nome, tratamento: p.tratamento, sobreONegocio: p.sobreONegocio }
      : 
        
        null,
    assistentes: listaDeAssistentes.map((a) => ({
      ...a,
      
      
      canais:
        linhasDeCanal === null
          ? null
          : linhasDeCanal
              .filter((c) => (c.agente_id ?? null) === a.id)
              .map((c) => ({ id: c.id, nome: c.nome })),
      
      
      blocosVisiveis: blocosPorAssistente ? (blocosPorAssistente[a.id] ?? 0) : null,
      
      
      
      blocosExclusivos: exclusivosPorAssistente ? (exclusivosPorAssistente[a.id] ?? 0) : null,
    })),
    canais:
      linhasDeCanal === null
        ? null
        : linhasDeCanal.map((c) => ({
            id: c.id,
            nome: c.nome,
            telefone: c.telefone ?? null,
            ligado: Boolean(c.agente_ligado),
            
            
            
            calaAoResponderDeFora: getProvider(c.provider)?.capabilities.ecoaEnvioProprio === true,
          })),
    custo,
    horario,
    
    
    atendimentoAgora: avaliarAtendimento(horario, Date.now()),
  }
}
