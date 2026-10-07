import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { motivoDeBloqueioAtual } from '@/server/license/bloqueio'
import { buscarRelatorio, rodarRelatorio } from '@/server/crm/relatorios'
import {
  configDeParams, ehTipoRelatorio, linhasExport, nomeArquivoCsv, ROTULO_TIPO,
  type ConfigRelatorio, type TipoRelatorio,
} from '@/lib/relatorios'
import { paraCsv } from '@/lib/csv'

export const dynamic = 'force-dynamic'


export async function GET(req: Request) {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) return new Response('Sem espaço de trabalho ativo.', { status: 403 })

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (await motivoDeBloqueioAtual()) {
    return new Response(
      'Exportação indisponível: a licença deste servidor está bloqueada. Abra /licenca para ver o motivo e o que fazer.',
      { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
    )
  }

  const sp = Object.fromEntries(new URL(req.url).searchParams)

  const salvo = sp.salvo ? await buscarRelatorio(cliente, ws, sp.salvo) : null
  if (sp.salvo && !salvo) return new Response('Relatório não encontrado.', { status: 404 })

  let tipo: TipoRelatorio
  let config: ConfigRelatorio
  if (ehTipoRelatorio(sp.tipo)) {
    tipo = sp.tipo
    config = configDeParams(sp)
  } else if (salvo) {
    tipo = salvo.tipo
    config = salvo.config
  } else {
    return new Response('Escolha um tipo de relatório para exportar.', { status: 400 })
  }

  const resultado = await rodarRelatorio(cliente, ws, tipo, config)
  
  
  const corpo = paraCsv(linhasExport(resultado))
  const arquivo = `${nomeArquivoCsv(salvo?.nome ?? ROTULO_TIPO[tipo])}.csv`

  return new Response(corpo, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${arquivo}"`,
      
      'cache-control': 'no-store',
    },
  })
}
