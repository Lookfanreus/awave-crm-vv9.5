import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { exigirSessao } from '@/server/auth/sessao'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { carregarContato } from '@/server/crm/detalhes'
import { opcoesForm } from '@/server/crm/acoes'
import { moedaBRL } from '@/lib/formato'
import Timeline from '@/app/(app)/_crm/Timeline'
import ComporAtividade from '@/app/(app)/_crm/ComporAtividade'
import BotaoEditar from '@/app/(app)/_crm/BotaoEditar'
import BadgeStatus from '@/app/(app)/_crm/BadgeStatus'
import Relacionados from '@/app/(app)/_crm/Relacionados'
import CamposCustomizados from '@/app/(app)/_crm/CamposCustomizados'
import BotaoExcluir from '@/app/(app)/_crm/BotaoExcluir'
import { excluirContato, contarEfeitoContato } from '@/server/crm/excluir'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import Slot from '@/components/custom/Slot'
import estilos from '@/app/(app)/_crm/crm.module.css'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Contato') }
}


function Celula({ rotulo, children }: { rotulo: string; children?: React.ReactNode }) {
  return (
    <div className={estilos.faixaCelula}>
      <span className={estilos.faixaRotulo}>{rotulo}</span>
      <span className={`${estilos.faixaValor}${children ? '' : ` ${estilos.faixaVazio}`}`}>
        {children ?? '—'}
      </span>
    </div>
  )
}


export default async function ContatoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  await exigirSessao()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) notFound()

  const [contato, opcoes] = await Promise.all([
    carregarContato(cliente, ws, id),
    opcoesForm(),
  ])

  
  if (!contato) notFound()

  
  
  
  
  
  const temLateral = !!contato.notas || contato.camposDef.length > 0

  const registroEditar = {
    id: contato.id,
    nome: contato.nome,
    email: contato.email,
    telefone: contato.telefone,
    origem: contato.origem,
    empresa_id: contato.empresaId,
    notas: contato.notas,
  }

  return (
    <>
      <CabecalhoPagina
        acima={
          <Link href="/contatos" className={estilos.voltar}>
            <ArrowLeft size={14} aria-hidden />
            Contatos
          </Link>
        }
        titulo={contato.nome}
        acoes={<BotaoEditar tipo="contato" registro={registroEditar} opcoes={opcoes} />}
      />

      <div className={estilos.faixa}>
        <Celula rotulo="E-mail">
          {contato.email ? <a href={`mailto:${contato.email}`}>{contato.email}</a> : null}
        </Celula>
        <Celula rotulo="Telefone">{contato.telefone}</Celula>
        <Celula rotulo="Origem">
          {contato.origem ? contato.origem.charAt(0).toUpperCase() + contato.origem.slice(1) : null}
        </Celula>
        <Celula rotulo="Empresa">
          {contato.empresaId && contato.empresaNome
            ? <Link href={`/empresas/${contato.empresaId}`}>{contato.empresaNome}</Link>
            : null}
        </Celula>
      </div>

      <div className={`${estilos.detalheGrade}${temLateral ? '' : ` ${estilos.detalheGradeUnica}`}`}>
        <div className={estilos.detalhePrincipal}>
          {}
          <Relacionados
            titulo="Negócios"
            vazio="Nenhum negócio ligado a este contato."
            itens={contato.negocios.map((n) => ({
              id: n.id,
              principal: n.titulo,
              secundario: n.valor != null ? moedaBRL(n.valor) : null,
              badge: <BadgeStatus status={n.status} />,
              href: `/negocios/${n.id}`,
            }))}
          />

          <Timeline atividades={contato.atividades} />
          <ComporAtividade contatoId={contato.id} />
          {}
          <Slot ancora="contato.detalhe.rodape" ctx={{ contatoId: contato.id }} />
        </div>

        {temLateral && (
          <aside className={estilos.detalheLateral}>
            {contato.notas && (
              <section className={estilos.bloco}>
                <div className={estilos.blocoCab}>
                  <h2 className={estilos.blocoTitulo}>Notas</h2>
                </div>
                <p className={`${estilos.notasTexto} ${estilos.blocoCorpo}`}>{contato.notas}</p>
              </section>
            )}

            <CamposCustomizados
              entidade="contato"
              id={contato.id}
              campos={contato.campos}
              definicoes={contato.camposDef}
            />
          </aside>
        )}
      </div>

      {}
      <BotaoExcluir
        alvo="contato"
        id={contato.id}
        rotulo="Excluir contato"
        aoExcluir={excluirContato}
        contar={contarEfeitoContato}
        redirecionarPara="/contatos"
      />
    </>
  )
}
