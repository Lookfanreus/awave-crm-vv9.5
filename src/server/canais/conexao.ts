































import 'server-only'
import { admin } from '@/server/supabase'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { ehOwnerDoWorkspace } from '@/server/auth/owner-workspace'
import { exigirEngineLiberado } from '@/server/license/exigir'
import { lerConfig } from '@/server/configuracoes'
import { redigirValores } from '@/lib/canais/redigir'
import { ehHostLiteralDeIp } from '@/server/canais/midia'
import { apagarObjetosDoCanal } from '@/server/canais/midia-bucket'
import {
  apagarSegredosDoCanal,
  aparadoOuLanca,
  CHAVE_ADMIN,
  chaveToken,
  chaveWebhook,
  cunharSegredo,
  gravarSegredosDaMeta,
  gravarSegredosDoCanal,
} from '@/server/canais/segredos'
import { getProvider } from '@/server/canais/registry'
import {
  credenciaisCloud,
  credenciaisInstagram,
  SLUG_CLOUD,
  SLUG_INSTAGRAM,
  type ProviderSlug,
} from '@/server/canais/types'
import { getSecret } from '@/server/secrets'








import { CHAVE_URL_PUBLICA } from '@/lib/canais/url-publica'

type CanalLinha = {
  id: string
  workspace_id: string
  
  provider: string
  external_id: string | null
  status_conexao: string
  config: { server_url?: string }
}


function validarServerUrl(bruta: string): string {
  let u: URL
  try {
    u = new URL(bruta.trim())
  } catch {
    throw new Error(
      'Isso não parece um endereço. Use algo como https://servidor-de-mensagens.exemplo.com',
    )
  }
  if (u.protocol !== 'https:') {
    throw new Error(
      'O endereço do servidor precisa começar com https:// — o token deste canal viaja nessa conexão.',
    )
  }
  if (ehHostLiteralDeIp(u.hostname)) {
    throw new Error('Use o nome do servidor de mensagens, não um endereço de IP.')
  }
  return u.origin
}

async function exigirDonoDoDeploy(): Promise<void> {
  if (!(await ehDonoDoDeploy())) {
    throw new Error('Só quem instalou este CRM pode fazer isto — peça a essa pessoa.')
  }
}


async function canalDoWorkspace(ws: string, canalId: string): Promise<CanalLinha> {
  const { data } = await admin()
    .from('canais')
    .select('id, workspace_id, provider, external_id, status_conexao, config')
    .eq('workspace_id', ws)
    .eq('id', canalId)
    .maybeSingle()
  const linha = data as CanalLinha | null
  if (!linha) throw new Error('Este canal não existe neste espaço de trabalho. Recarregue a página: ele pode ter sido apagado.')
  return linha
}


function usaConexaoPareada(canal: CanalLinha): boolean {
  return getProvider(canal.provider)?.capabilities.conexaoPareada === true
}


function exigirConexaoPareada(canal: CanalLinha): void {
  if (!usaConexaoPareada(canal)) {
    throw new Error('Este canal não usa conexão por aparelho — esta ação é só do canal do código de pareamento.')
  }
}


function urlDoWebhook(
  urlPublica: string,
  provider: ProviderSlug,
  canalId: string,
  segredoWebhook: string,
): string {
  return `${urlPublica.replace(/\/+$/, '')}/api/canais/${provider}/webhook/${canalId}/${segredoWebhook}`
}


async function exigirOwnerDoWorkspace(ws: string): Promise<void> {
  if (!(await ehOwnerDoWorkspace(ws)))
    throw new Error('Só um dono do espaço de trabalho a que este canal pertence pode fazer isto.')
}


async function chamarProvider(
  url: string,
  cabecalho: Record<string, string>,
  corpo: unknown,
  segredos: string[],
  metodo = 'POST',
): Promise<Record<string, unknown>> {
  let r: Response
  try {
    r = await fetch(url, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...cabecalho },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    throw new Error(`Não consegui falar com o servidor de mensagens: ${redigirValores(err, segredos)}`)
  }
  let dados: Record<string, unknown> = {}
  try {
    dados = ((await r.json()) as Record<string, unknown>) ?? {}
  } catch {
    dados = {}
  }
  if (!r.ok) {
    throw new Error(
      `O servidor de mensagens recusou (HTTP ${r.status}): ${redigirValores(JSON.stringify(dados), segredos)}`,
    )
  }
  return dados
}

function comoTexto(x: unknown): string | null {
  return typeof x === 'string' && x.trim() ? x.trim() : null
}


async function registrarWebhook(
  serverUrl: string,
  token: string,
  urlPublica: string,
  canalId: string,
  segredoWebhook: string,
): Promise<void> {
  await chamarProvider(
    `${serverUrl}/webhook`,
    { token },
    {
      enabled: true,
      url: urlDoWebhook(urlPublica, 'uazapi', canalId, segredoWebhook),
      events: ['messages', 'messages_update', 'connection'],
    },
    [token, serverUrl, segredoWebhook],
  )
}


async function desfazerCanal(
  workspaceId: string,
  canalId: string,
  provider?: { serverUrl: string; token: string },
): Promise<void> {
  
  
  
  
  if (provider) {
    try {
      await chamarProvider(
        `${provider.serverUrl}/instance`,
        { token: provider.token },
        undefined,
        [provider.token, provider.serverUrl],
        'DELETE',
      )
    } catch {
      
    }
  }
  try {
    
    await admin().from('canais').delete().eq('workspace_id', workspaceId).eq('id', canalId)
    await apagarSegredosDoCanal(canalId)
  } catch {
    
  }
}


export async function criarCanal(
  workspaceId: string,
  dados: { nome: string; serverUrl: string },
): Promise<{ canalId: string }> {
  await exigirEngineLiberado()
  await exigirDonoDoDeploy()

  const serverUrl = validarServerUrl(dados.serverUrl)
  const nome = dados.nome.trim()
  if (!nome) throw new Error('Dê um nome a este canal antes de continuar.')

  const urlPublica = comoTexto(await lerConfig(CHAVE_URL_PUBLICA))
  if (!urlPublica) {
    throw new Error(
      'Falta o "Endereço público deste CRM". Preencha-o no primeiro bloco desta tela: sem ele o servidor de mensagens não tem para onde entregar as mensagens.',
    )
  }

  const adminToken = await getSecret(CHAVE_ADMIN)
  if (!adminToken)
    throw new Error(
      'Falta o "Token de administrador do servidor". Salve-o no bloco acima antes de conectar um número.',
    )

  const segredoWebhook = cunharSegredo()

  const { data: linha, error } = await admin()
    .from('canais')
    .insert({
      workspace_id: workspaceId,
      provider: 'uazapi',
      nome,
      
      
      external_id: nome,
      status_conexao: 'desconectado',
      
      
      config: { server_url: serverUrl },
    })
    .select('id')
    .single()

  
  
  
  
  
  
  
  
  
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === '23505') {
    throw new Error('Não dá para usar esse nome neste CRM. Escolha outro — se você já tem um canal com esse nome, apague-o antes.')
  }
  const canalId = (linha as { id: string } | null)?.id
  if (!canalId) throw new Error('Não consegui salvar este canal agora. Tente de novo em alguns instantes.')

  
  let criada: Record<string, unknown>
  try {
    criada = await chamarProvider(
      `${serverUrl}/instance/init`,
      { admintoken: adminToken },
      { name: nome },
      [adminToken, serverUrl],
    )
  } catch (err) {
    await desfazerCanal(workspaceId, canalId)
    throw err
  }

  const token = comoTexto(criada.token)
  const instancia = comoTexto((criada.instance as { name?: unknown } | undefined)?.name) ?? nome
  if (!token) {
    
    
    
    
    await desfazerCanal(workspaceId, canalId)
    throw new Error(
      'O servidor de mensagens criou a conexão mas não devolveu a credencial dela. Nada foi guardado aqui — confira no painel dele se sobrou uma conexão pela metade.',
    )
  }

  
  
  
  
  if (instancia !== nome) {
    const { error: erroDoNome } = await admin()
      .from('canais')
      .update({ external_id: instancia })
      .eq('workspace_id', workspaceId)
      .eq('id', canalId)
    if (erroDoNome) {
      await desfazerCanal(workspaceId, canalId, { serverUrl, token })
      throw new Error('Não consegui salvar este canal agora. Tente de novo em alguns instantes.')
    }
  }

  
  
  
  
  if (!(await gravarSegredosDoCanal(canalId, token, segredoWebhook))) {
    await desfazerCanal(workspaceId, canalId, { serverUrl, token })
    throw new Error(
      'Não consegui guardar a credencial deste canal com segurança. Nada foi criado — tente de novo.',
    )
  }

  await registrarWebhook(serverUrl, token, urlPublica, canalId, segredoWebhook)

  return { canalId }
}


export async function criarCanalCloud(
  workspaceId: string,
  dados: {
    nome: string
    phoneNumberId: string
    accessToken: string
    appSecret: string
    verifyToken: string
  },
): Promise<{ canalId: string; urlDoWebhook: string }> {
  await exigirEngineLiberado()
  await exigirDonoDoDeploy()

  const nome = dados.nome.trim()
  if (!nome) throw new Error('Dê um nome a este canal antes de continuar.')

  const urlPublica = comoTexto(await lerConfig(CHAVE_URL_PUBLICA))
  if (!urlPublica) {
    throw new Error(
      'Falta o "Endereço público deste CRM". Preencha-o no primeiro bloco desta tela: sem ele a Meta não tem para onde entregar as mensagens.',
    )
  }

  
  
  
  
  
  const creds = credenciaisCloud({
    accessToken: dados.accessToken,
    phoneNumberId: dados.phoneNumberId,
  })
  if (!creds || creds.tipo !== SLUG_CLOUD) {
    throw new Error(
      'Confira o identificador do número (só dígitos, como aparece no painel da Meta) e cole o token de acesso inteiro.',
    )
  }

  
  
  const appSecret = aparadoOuLanca('chave de assinatura do aplicativo', dados.appSecret)
  const verifyToken = aparadoOuLanca('token de verificação', dados.verifyToken)

  const segredoWebhook = cunharSegredo()

  const { data: linha, error } = await admin()
    .from('canais')
    .insert({
      workspace_id: workspaceId,
      provider: SLUG_CLOUD,
      nome,
      
      
      
      
      external_id: creds.phoneNumberId,
      status_conexao: 'desconectado',
      
      
      
      config: {},
    })
    .select('id')
    .single()

  
  
  
  
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === '23505') {
    throw new Error('Este número já está ligado a um canal deste CRM. Apague o outro antes de criar este.')
  }
  const canalId = (linha as { id: string } | null)?.id
  if (!canalId) throw new Error('Não consegui salvar este canal agora. Tente de novo em alguns instantes.')

  
  
  
  
  
  
  if (!(await gravarSegredosDaMeta(canalId, dados.accessToken, appSecret, verifyToken, segredoWebhook))) {
    await desfazerCanal(workspaceId, canalId)
    throw new Error(
      'Não consegui guardar a credencial deste canal com segurança. Nada foi criado — tente de novo.',
    )
  }

  return { canalId, urlDoWebhook: urlDoWebhook(urlPublica, SLUG_CLOUD, canalId, segredoWebhook) }
}


export async function criarCanalInstagram(
  workspaceId: string,
  dados: {
    nome: string
    contaId: string
    accessToken: string
    appSecret: string
    verifyToken: string
  },
): Promise<{ canalId: string; urlDoWebhook: string }> {
  await exigirEngineLiberado()
  await exigirDonoDoDeploy()

  const nome = dados.nome.trim()
  if (!nome) throw new Error('Dê um nome a este canal antes de continuar.')

  const urlPublica = comoTexto(await lerConfig(CHAVE_URL_PUBLICA))
  if (!urlPublica) {
    throw new Error(
      'Falta o "Endereço público deste CRM". Preencha-o no primeiro bloco desta tela: sem ele a Meta não tem para onde entregar as mensagens.',
    )
  }

  
  
  
  
  
  
  
  
  
  const creds = credenciaisInstagram({
    accessToken: dados.accessToken,
    contaId: dados.contaId,
  })
  if (!creds || creds.tipo !== SLUG_INSTAGRAM) {
    throw new Error(
      'Confira o identificador da conta do Instagram (só dígitos, como aparece no painel da ' +
        'Meta — não é o @ da conta nem o identificador da Página do Facebook) e cole o token de ' +
        'acesso inteiro.',
    )
  }

  
  
  const appSecret = aparadoOuLanca('chave de assinatura do aplicativo', dados.appSecret)
  const verifyToken = aparadoOuLanca('token de verificação', dados.verifyToken)

  const segredoWebhook = cunharSegredo()

  const { data: linha, error } = await admin()
    .from('canais')
    .insert({
      workspace_id: workspaceId,
      provider: SLUG_INSTAGRAM,
      nome,
      
      
      
      
      
      external_id: creds.contaId,
      status_conexao: 'desconectado',
      
      
      
      config: {},
    })
    .select('id')
    .single()

  
  
  
  
  const codigo = (error as { code?: string } | null)?.code
  if (codigo === '23505') {
    throw new Error('Esta conta já está ligada a um canal deste CRM. Apague o outro antes de criar este.')
  }
  const canalId = (linha as { id: string } | null)?.id
  if (!canalId) throw new Error('Não consegui salvar este canal agora. Tente de novo em alguns instantes.')

  
  
  
  
  
  
  if (!(await gravarSegredosDaMeta(canalId, dados.accessToken, appSecret, verifyToken, segredoWebhook))) {
    await desfazerCanal(workspaceId, canalId)
    throw new Error(
      'Não consegui guardar a credencial deste canal com segurança. Nada foi criado — tente de novo.',
    )
  }

  return { canalId, urlDoWebhook: urlDoWebhook(urlPublica, SLUG_INSTAGRAM, canalId, segredoWebhook) }
}


export async function reconectarCanal(
  workspaceId: string,
  canalId: string,
): Promise<{ qr: string | null }> {
  await exigirEngineLiberado()
  await exigirOwnerDoWorkspace(workspaceId)

  const canal = await canalDoWorkspace(workspaceId, canalId)
  
  
  
  exigirConexaoPareada(canal)
  if (canal.status_conexao === 'conectado') {
    throw new Error('Este canal já está conectado — só um canal desconectado precisa parear de novo.')
  }
  const serverUrl = comoTexto(canal.config?.server_url)
  if (!serverUrl)
    throw new Error(
      'Este canal está sem o endereço do servidor de mensagens. Salve-o na linha deste canal antes de continuar.',
    )

  const token = await getSecret(chaveToken(canalId))
  if (!token)
    throw new Error(
      'Este canal está sem a credencial guardada criptografada. Apague este canal e crie-o de novo.',
    )

  const r = await chamarProvider(`${serverUrl}/instance/connect`, { token }, {}, [token, serverUrl])

  await admin()
    .from('canais')
    .update({ status_conexao: 'pareando', atualizado_em: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', canalId)

  return { qr: comoTexto(r.qrcode) ?? comoTexto((r.instance as { qrcode?: unknown } | undefined)?.qrcode) }
}


export async function registrarWebhookDoCanal(
  workspaceId: string,
  canalId: string,
): Promise<void> {
  await exigirEngineLiberado()
  await exigirDonoDoDeploy()

  const canal = await canalDoWorkspace(workspaceId, canalId)
  
  
  exigirConexaoPareada(canal)
  const serverUrl = comoTexto(canal.config?.server_url)
  if (!serverUrl)
    throw new Error(
      'Este canal está sem o endereço do servidor de mensagens. Salve-o na linha deste canal antes de continuar.',
    )

  const urlPublica = comoTexto(await lerConfig(CHAVE_URL_PUBLICA))
  if (!urlPublica) {
    throw new Error(
      'Falta o "Endereço público deste CRM". Preencha-o no primeiro bloco desta tela: sem ele o servidor de mensagens não tem para onde entregar as mensagens.',
    )
  }

  const token = await getSecret(chaveToken(canalId))
  if (!token)
    throw new Error(
      'Este canal está sem a credencial guardada criptografada. Apague este canal e crie-o de novo.',
    )
  const segredoWebhook = await getSecret(chaveWebhook(canalId))
  if (!segredoWebhook)
    throw new Error(
      'Este canal está sem o segredo do endereço de recebimento. Apague este canal e crie-o de novo.',
    )

  await registrarWebhook(serverUrl, token, urlPublica, canalId, segredoWebhook)
}


export async function editarConfig(
  workspaceId: string,
  canalId: string,
  config: { server_url: string },
): Promise<void> {
  await exigirEngineLiberado()
  await exigirDonoDoDeploy()

  
  
  
  
  const canal = await canalDoWorkspace(workspaceId, canalId)
  exigirConexaoPareada(canal)
  const serverUrl = validarServerUrl(config.server_url)

  await admin()
    .from('canais')
    .update({ config: { server_url: serverUrl }, atualizado_em: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', canalId)
}


export async function excluirCanal(workspaceId: string, canalId: string): Promise<void> {
  await exigirEngineLiberado()
  await exigirDonoDoDeploy()

  const canal = await canalDoWorkspace(workspaceId, canalId)

  
  
  
  
  
  
  
  
  
  
  
  
  
  if (usaConexaoPareada(canal)) {
    const serverUrl = comoTexto(canal.config?.server_url)
    const token = await getSecret(chaveToken(canalId))

    if (serverUrl && token) {
      try {
        await chamarProvider(`${serverUrl}/instance`, { token }, undefined, [token, serverUrl], 'DELETE')
      } catch {
        
      }
    }
  }

  
  
  
  
  
  
  
  await apagarObjetosDoCanal(workspaceId, canalId)
  await admin().from('canais').delete().eq('workspace_id', workspaceId).eq('id', canalId)
  
  await apagarSegredosDoCanal(canalId)
}
