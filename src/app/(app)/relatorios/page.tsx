import { redirect } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { listarFunis } from '@/server/crm/funis'
import { listarRelatorios, opcoesAgrupamento, rodarRelatorio } from '@/server/crm/relatorios'
import { configDeParams, ehTipoRelatorio } from '@/lib/relatorios'
import Construtor from './Construtor'
import ListaSalvos from './ListaSalvos'
import Resultado from './Resultado'
import estilos from './relatorios.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import EstadoVazio from '@/components/ui/EstadoVazio'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Relatórios') }
}


export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) redirect('/sem-workspace')

  const sp = await searchParams
  const tipo = ehTipoRelatorio(sp.tipo) ? sp.tipo : null
  const config = configDeParams(sp)

  const [salvos, funis] = await Promise.all([listarRelatorios(cliente, ws), listarFunis()])
  
  
  const funilEfetivo = config.funilId ?? funis.find((f) => f.is_padrao)?.id
  const agrupamentos = await opcoesAgrupamento(cliente, ws, funilEfetivo)
  const resultado = tipo ? await rodarRelatorio(cliente, ws, tipo, config) : null

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo="Relatórios"
        
        
        
        
        subtitulo="Onde os negócios param, quanto tempo levam em cada etapa e quanto deve fechar."
      />

      <div className={estilos.layout}>
        <ListaSalvos relatorios={salvos} />
        <div className={estilos.coluna}>
          <Construtor tipo={tipo ?? 'funil_conversao'} config={config} funis={funis} agrupamentos={agrupamentos} />
          {resultado
            ? <Resultado resultado={resultado} />
            : (
              
              
              
              <section className={estilos.resultado}>
                <EstadoVazio
                  icone={<BarChart3 size={20} strokeWidth={1.75} />}
                  titulo="Nenhum resultado ainda"
                  texto="Escolha o tipo de relatório acima, ajuste o período e clique em Ver resultado."
                />
              </section>
            )}
        </div>
      </div>
    </div>
  )
}
