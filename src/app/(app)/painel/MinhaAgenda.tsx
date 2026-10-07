import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'
import { iconeDoTipo } from '@/app/(app)/_crm/iconesTipo'
import { dataAgenda } from '@/lib/formato'
import type { ItemAgenda } from '@/server/crm/agenda-consulta'
import EstadoVazio from '@/components/ui/EstadoVazio'
import Botao from '@/components/ui/Botao'
import estilos from './painel.module.css'


export default function MinhaAgenda({
  atrasadas, proximas, agora,
}: { atrasadas: ItemAgenda[]; proximas: ItemAgenda[]; agora: Date }) {
  const vazio = atrasadas.length === 0 && proximas.length === 0
  return (
    <div className={estilos.agendaBloco}>
      <div className={estilos.agendaHead}>
        <h3>Minha agenda</h3>
        <Link href="/agenda" className={estilos.agendaVerTudo}>Ver agenda</Link>
      </div>
      {vazio ? (
        
        
        
        
        
        <EstadoVazio
          icone={<CalendarPlus size={20} strokeWidth={1.75} />}
          titulo="Nada agendado"
          texto="Quem não marca o próximo passo esquece o negócio. A agenda começa dentro de um deles."
          acao={
            <Botao href="/negocios" variante="primario">
              Ver meus negócios
            </Botao>
          }
        />
      ) : (
        <>
          {atrasadas.length > 0 && (
            <p className={estilos.agendaAtrasoContagem}>
              🔴 {atrasadas.length} {atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}
            </p>
          )}
          <ul className={estilos.agendaLista}>
            {[...atrasadas, ...proximas].slice(0, 6).map((a) => {
              const Icone = iconeDoTipo(a.tipo.icone)
              const alvo = a.negocio ? `/negocios/${a.negocio.id}` : a.contato ? `/contatos/${a.contato.id}` : null
              const titulo = a.conteudo?.trim() || a.tipo.nome
              const linha = (
                <>
                  <span className={estilos.agendaIcone}><Icone size={14} /></span>
                  <span className={estilos.agendaTitulo}>{titulo}</span>
                  <span className={estilos.agendaQuando}>{dataAgenda(a.vencimento, agora)}</span>
                </>
              )
              return (
                
                
                <li key={a.id}>
                  {alvo
                    ? <Link href={alvo} className={estilos.agendaLink}>{linha}</Link>
                    : <span className={estilos.agendaLink}>{linha}</span>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
