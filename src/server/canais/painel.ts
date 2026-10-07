import 'server-only'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { lerConfig } from '@/server/configuracoes'
import { getSecret } from '@/server/secrets'
import { CHAVE_ADMIN, chaveWebhook } from '@/server/canais/segredos'
import { getProvider } from '@/server/canais/registry'
import { CHAVE_URL_PUBLICA } from '@/lib/canais/url-publica'
import { medirBucket, COTA_BYTES } from '@/server/canais/midia-tick'
import { PROVIDER_DE_SIMULACAO } from '@/lib/canais/simulacao'
import type { EstadoConexao } from '@/lib/canais/estado-canal'



export type CanalNoPainel = {
  id: string
  nome: string
  telefone: string | null
  estado: EstadoConexao
  serverUrl: string
  eventosRejeitados: number
  
  eventosRejeitadosAssinatura: number
  
  rejeitadoEm: string | null
  
  conexaoPareada: boolean
  
  resolvePorIdentidade: boolean
  
  temSegredoDeRecebimento: boolean
}

export type PainelDeCanais = {
  
  ehDono: boolean
  
  ehOwner: boolean
  urlPublica: string | null
  
  temAdminToken: boolean
  canais: CanalNoPainel[]
  
  armazenamento: { usadoBytes: number; cotaBytes: number; medido: boolean } | null
}

const CONHECIDOS = new Set<string>(['desconectado', 'pareando', 'conectado', 'erro'])


export function estadoDaLinha(bruto: unknown): EstadoConexao {
  return typeof bruto === 'string' && CONHECIDOS.has(bruto) ? (bruto as EstadoConexao) : 'desconhecido'
}

type LinhaCanal = {
  id: string
  nome: string
  provider: string
  telefone: string | null
  status_conexao: string
  config: { server_url?: string } | null
  eventos_rejeitados: number | null
  eventos_rejeitados_assinatura: number | null
  rejeitado_em: string | null
}

export async function lerPainelDeCanais(): Promise<PainelDeCanais> {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  const ehDono = await ehDonoDoDeploy()

  const vazio: PainelDeCanais = {
    ehDono,
    ehOwner: false,
    urlPublica: null,
    temAdminToken: false,
    canais: [],
    armazenamento: null,
  }
  if (!ws) return vazio

  
  
  
  
  
  
  const { data } = await cliente
    .from('canais')
    
    
    
    .select(
      'id, nome, provider, telefone, status_conexao, config, eventos_rejeitados, eventos_rejeitados_assinatura, rejeitado_em',
    )
    .eq('workspace_id', ws)
    .neq('provider', PROVIDER_DE_SIMULACAO)
    .order('criado_em', { ascending: true })

  
  
  const {
    data: { user },
  } = await cliente.auth.getUser()
  let ehOwner = false
  if (user) {
    const { data: membro } = await cliente
      .from('membros')
      .select('id')
      .eq('workspace_id', ws)
      .eq('user_id', user.id)
      .eq('papel', 'owner')
      .maybeSingle()
    ehOwner = Boolean(membro)
  }

  const urlPublica = (await lerConfig(CHAVE_URL_PUBLICA))?.trim() || null
  const temAdminToken = Boolean((await getSecret(CHAVE_ADMIN))?.trim())

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const segredosDeRecebimento = new Map<string, boolean>()
  for (const l of (data ?? []) as LinhaCanal[]) {
    segredosDeRecebimento.set(l.id, Boolean((await getSecret(chaveWebhook(l.id)))?.trim()))
  }

  const armazenamento = await medirBucket(ws)
    .then(({ bytes, medido }) => ({ usadoBytes: bytes, cotaBytes: COTA_BYTES, medido }))
    .catch(() => null)

  return {
    ehDono,
    ehOwner,
    urlPublica,
    temAdminToken,
    armazenamento,
    canais: ((data ?? []) as LinhaCanal[]).map((l) => ({
      id: l.id,
      nome: l.nome,
      telefone: l.telefone ?? null,
      estado: estadoDaLinha(l.status_conexao),
      serverUrl: typeof l.config?.server_url === 'string' ? l.config.server_url : '',
      eventosRejeitados: l.eventos_rejeitados ?? 0,
      eventosRejeitadosAssinatura: l.eventos_rejeitados_assinatura ?? 0,
      rejeitadoEm: l.rejeitado_em ?? null,
      conexaoPareada: getProvider(l.provider)?.capabilities.conexaoPareada === true,
      
      
      
      
      
      resolvePorIdentidade: getProvider(l.provider)?.identidadesDaInstancia != null,
      temSegredoDeRecebimento: segredosDeRecebimento.get(l.id) === true,
    })),
  }
}
