import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarPlus } from 'lucide-react'
import { exigirSessao } from '@/server/auth/sessao'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { resolverMembroAtivo } from '@/server/auth/membro-ativo'
import { listarAgenda, type ItemAgenda } from '@/server/crm/agenda-consulta'
import { classificarVencimento } from '@/server/crm/agenda'
import SecaoAgenda from './SecaoAgenda'
import Botao from '@/components/ui/Botao'
import estilos from './agenda.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import EstadoVazio from '@/components/ui/EstadoVazio'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Agenda') }
}


export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ escopo?: string }>
}) {
  await exigirSessao()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) redirect('/sem-workspace')

  const membroId = await resolverMembroAtivo({ cliente, ws })
  const sp = await searchParams
  
  const escopo: 'minhas' | 'todas' = sp.escopo === 'todas' || !membroId ? 'todas' : 'minhas'
  const itens = await listarAgenda({ cliente, ws, membroId, escopo })

  const agora = new Date()
  const baldes: Record<'atrasada' | 'hoje' | 'proxima', ItemAgenda[]> = { atrasada: [], hoje: [], proxima: [] }
  for (const it of itens) baldes[classificarVencimento(it.vencimento, agora)].push(it)

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo="Agenda"
        subtitulo="Suas atividades a fazer, por prazo."
        acoes={
          <div className={estilos.filtro}>
            <Link href="/agenda?escopo=minhas" className={escopo === 'minhas' ? estilos.filtroAtivo : estilos.filtroItem}>Minhas</Link>
            <Link href="/agenda?escopo=todas" className={escopo === 'todas' ? estilos.filtroAtivo : estilos.filtroItem}>Todas</Link>
          </div>
        }
      />

      {itens.length === 0 ? (
        
        
        
        
        
        
        
        
        
        
        <EstadoVazio
          icone={<CalendarPlus size={20} strokeWidth={1.75} />}
          titulo={escopo === 'minhas' ? 'Nada na sua agenda' : 'Nada agendado'}
          texto={
            escopo === 'minhas'
              ? 'Nenhuma atividade sua a fazer. Troque o filtro para Todas e veja as do resto do time, ou marque o próximo passo dentro de um negócio.'
              : 'Quem não marca o próximo passo esquece o negócio. A agenda começa dentro de um deles.'
          }
          acao={
            <Botao href="/negocios" variante="primario">
              Ver negócios
            </Botao>
          }
        />
      ) : (
        <>
          <SecaoAgenda titulo="Atrasadas" itens={baldes.atrasada} atraso />
          <SecaoAgenda titulo="Hoje" itens={baldes.hoje} deslocamento={baldes.atrasada.length} />
          <SecaoAgenda
            titulo="Próximas"
            itens={baldes.proxima}
            deslocamento={baldes.atrasada.length + baldes.hoje.length}
          />
        </>
      )}
    </div>
  )
}
