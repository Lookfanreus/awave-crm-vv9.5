import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { exigirSessao } from '@/server/auth/sessao'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { carregarEmpresa } from '@/server/crm/detalhes'
import { moedaBRL } from '@/lib/formato'
import BotaoEditar from '@/app/(app)/_crm/BotaoEditar'
import BadgeStatus from '@/app/(app)/_crm/BadgeStatus'
import Relacionados from '@/app/(app)/_crm/Relacionados'
import CamposCustomizados from '@/app/(app)/_crm/CamposCustomizados'
import BotaoExcluir from '@/app/(app)/_crm/BotaoExcluir'
import { excluirEmpresa } from '@/server/crm/excluir'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import Slot from '@/components/custom/Slot'
import estilos from '@/app/(app)/_crm/crm.module.css'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Empresa') }
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


export default async function EmpresaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  await exigirSessao()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) notFound()

  const empresa = await carregarEmpresa(cliente, ws, id)
  if (!empresa) notFound()

  
  const temLateral = !!empresa.notas || empresa.camposDef.length > 0

  const registroEditar = {
    id: empresa.id,
    nome: empresa.nome,
    site: empresa.site,
    telefone: empresa.telefone,
    notas: empresa.notas,
  }

  return (
    <>
      <CabecalhoPagina
        acima={
          <Link href="/empresas" className={estilos.voltar}>
            <ArrowLeft size={14} aria-hidden />
            Empresas
          </Link>
        }
        titulo={empresa.nome}
        acoes={<BotaoEditar tipo="empresa" registro={registroEditar} />}
      />

      <div className={estilos.faixa}>
        <Celula rotulo="Site">
          {empresa.site
            ? <a href={empresa.site} target="_blank" rel="noopener noreferrer">{empresa.site}</a>
            : null}
        </Celula>
        <Celula rotulo="Telefone">{empresa.telefone}</Celula>
        <Celula rotulo="Contatos">{empresa.contatos.length}</Celula>
        <Celula rotulo="Negócios">{empresa.negocios.length}</Celula>
      </div>

      <div className={`${estilos.detalheGrade}${temLateral ? '' : ` ${estilos.detalheGradeUnica}`}`}>
        <div className={estilos.detalhePrincipal}>
          <Relacionados
            titulo="Contatos"
            vazio="Nenhum contato nesta empresa."
            itens={empresa.contatos.map((c) => ({
              id: c.id,
              principal: c.nome,
              secundario: c.email,
              href: `/contatos/${c.id}`,
            }))}
          />

          <Relacionados
            titulo="Negócios"
            vazio="Nenhum negócio ligado a esta empresa."
            itens={empresa.negocios.map((n) => ({
              id: n.id,
              principal: n.titulo,
              secundario: n.valor != null ? moedaBRL(n.valor) : null,
              badge: <BadgeStatus status={n.status} />,
              href: `/negocios/${n.id}`,
            }))}
          />
          {}
          <Slot ancora="empresa.detalhe.rodape" ctx={{ empresaId: empresa.id }} />
        </div>

        {temLateral && (
          <aside className={estilos.detalheLateral}>
            {empresa.notas && (
              <section className={estilos.bloco}>
                <div className={estilos.blocoCab}>
                  <h2 className={estilos.blocoTitulo}>Notas</h2>
                </div>
                <p className={`${estilos.notasTexto} ${estilos.blocoCorpo}`}>{empresa.notas}</p>
              </section>
            )}

            <CamposCustomizados
              entidade="empresa"
              id={empresa.id}
              campos={empresa.campos}
              definicoes={empresa.camposDef}
            />
          </aside>
        )}
      </div>

      {}
      <BotaoExcluir
        alvo="empresa"
        id={empresa.id}
        rotulo="Excluir empresa"
        aoExcluir={excluirEmpresa}
        redirecionarPara="/empresas"
      />
    </>
  )
}
