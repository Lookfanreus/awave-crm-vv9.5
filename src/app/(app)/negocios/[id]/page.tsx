import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { exigirSessao } from '@/server/auth/sessao'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { carregarNegocio } from '@/server/crm/detalhes'
import { opcoesForm } from '@/server/crm/acoes'
import { listarFunis } from '@/server/crm/funis'
import { listarTiposSessao } from '@/server/crm/agenda-consulta'
import { proximaAtividade, classificarVencimento } from '@/server/crm/agenda'
import { moedaBRL } from '@/lib/formato'
import { dataPrevisaoBR } from '@/lib/previsao'
import Timeline from '@/app/(app)/_crm/Timeline'
import ProximaAtividade from '@/app/(app)/_crm/ProximaAtividade'
import ComporAtividade from '@/app/(app)/_crm/ComporAtividade'
import SeletorEtapa from '@/app/(app)/_crm/SeletorEtapa'
import SeletorFunil from '@/app/(app)/_crm/SeletorFunil'
import SeletorResponsavel from '@/app/(app)/_crm/SeletorResponsavel'
import Avatar from '@/components/ui/Avatar'
import { nomeDaPessoa } from '@/server/crm/pessoas'
import BotoesGanharPerder from '@/app/(app)/_crm/BotoesGanharPerder'
import BotaoEditar from '@/app/(app)/_crm/BotaoEditar'
import BotaoExcluir from '@/app/(app)/_crm/BotaoExcluir'
import BotaoDuplicar from '@/app/(app)/_crm/BotaoDuplicar'
import { excluirNegocio, contarEfeitoNegocio } from '@/server/crm/excluir'
import BadgeStatus from '@/app/(app)/_crm/BadgeStatus'
import CamposCustomizados from '@/app/(app)/_crm/CamposCustomizados'
import Anexos from '@/app/(app)/_crm/Anexos'
import { listarAnexos } from '@/server/crm/anexos'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import estilos from '@/app/(app)/_crm/crm.module.css'
import { tituloDaPagina } from '@/server/marca'
import Slot from '@/components/custom/Slot'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id: _id } = await params
  return { title: await tituloDaPagina('Negócio') }
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


export default async function NegocioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  
  await exigirSessao()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) notFound()

  
  const [negocio, opcoes, tipos, funis, anexos] = await Promise.all([
    carregarNegocio(cliente, ws, id),
    opcoesForm(),
    listarTiposSessao({ cliente, ws }),
    listarFunis(),
    listarAnexos(id),
  ])

  
  if (!negocio) notFound()

  
  
  const responsavelNome = nomeDaPessoa(opcoes.pessoas, negocio.responsavelId)

  
  const proxima = proximaAtividade(negocio.atividades)
  const proximaAtrasada = proxima?.vencimento != null && classificarVencimento(proxima.vencimento, new Date()) === 'atrasada'

  
  
  
  
  
  
  
  
  
  const temLateral = true

  
  const registroEditar = {
    id: negocio.id,
    titulo: negocio.titulo,
    valor: negocio.valor,
    contato_id: negocio.contatoId,
    empresa_id: negocio.empresaId,
    previsao_fechamento: negocio.previsaoFechamento,
    responsavel_id: negocio.responsavelId,
  }

  return (
    <>
      <CabecalhoPagina
        acima={
          
          <Link href={`/negocios?funil=${negocio.pipelineId}`} className={estilos.voltar}>
            <ArrowLeft size={14} aria-hidden />
            Negócios
          </Link>
        }
        titulo={negocio.titulo}
        subtitulo={
          <span className={estilos.detalheSub}>
            <BadgeStatus status={negocio.status} />
            {negocio.status === 'perdido' && negocio.motivo_perda
              ? <span>Motivo: {negocio.motivo_perda}</span>
              : null}
            {}
            {negocio.status !== 'aberto' && responsavelNome && (
              <span className={estilos.subResponsavel}>
                <Avatar nome={responsavelNome} tamanho="sm" />
                Responsável: {responsavelNome}
              </span>
            )}
          </span>
        }
        
        acoes={
          <>
            <BotaoDuplicar id={negocio.id} />
            <BotaoEditar registro={registroEditar} opcoes={opcoes} />
          </>
        }
      />

      <div className={estilos.faixa}>
        <Celula rotulo="Valor">
          {negocio.valor != null ? moedaBRL(negocio.valor) : null}
        </Celula>
        <Celula rotulo="Previsão de fechamento">
          {negocio.previsaoFechamento ? dataPrevisaoBR(negocio.previsaoFechamento) : null}
        </Celula>
        <Celula rotulo="Contato">
          {negocio.contatoId && negocio.contatoNome
            ? <Link href={`/contatos/${negocio.contatoId}`}>{negocio.contatoNome}</Link>
            : null}
        </Celula>
        <Celula rotulo="Empresa">
          {negocio.empresaId && negocio.empresaNome
            ? <Link href={`/empresas/${negocio.empresaId}`}>{negocio.empresaNome}</Link>
            : null}
        </Celula>
      </div>

      {}
      {negocio.status === 'aberto' && (
        <div className={estilos.faixaControles}>
          <div className={estilos.controlesEsq}>
            {funis.length > 1 && (
              <SeletorFunil
                negocioId={negocio.id}
                funis={funis}
                funilAtualId={negocio.pipelineId}
              />
            )}
            <SeletorEtapa
              negocioId={negocio.id}
              etapas={negocio.etapas}
              etapaAtualId={negocio.etapaId}
            />
            {}
            <SeletorResponsavel
              negocioId={negocio.id}
              pessoas={opcoes.pessoas}
              responsavelAtualId={negocio.responsavelId}
            />
          </div>
          <div className={estilos.controlesDir}>
            <BotoesGanharPerder negocioId={negocio.id} />
          </div>
        </div>
      )}

      <div className={`${estilos.detalheGrade}${temLateral ? '' : ` ${estilos.detalheGradeUnica}`}`}>
        <div className={estilos.detalhePrincipal}>
          <ProximaAtividade proxima={proxima} atrasada={!!proximaAtrasada} negocioAberto={negocio.status === 'aberto'} />
          <Timeline atividades={negocio.atividades} />
          <ComporAtividade negocioId={negocio.id} tipos={tipos} />
        </div>

        {temLateral && (
          <aside className={estilos.detalheLateral}>
            <Anexos negocioId={negocio.id} anexos={anexos} />
            {}
            <CamposCustomizados
              entidade="negocio"
              id={negocio.id}
              campos={negocio.campos}
              definicoes={negocio.camposDef}
              obrigatorios={negocio.camposObrigatorios}
            />
            {}
            <Slot ancora="negocio.detalhe.lateral" ctx={{ negocioId: negocio.id }} />
          </aside>
        )}
      </div>

      {}
      <BotaoExcluir
        alvo="negocio"
        id={negocio.id}
        rotulo="Excluir negócio"
        aoExcluir={excluirNegocio}
        contar={contarEfeitoNegocio}
        redirecionarPara="/negocios"
      />
    </>
  )
}
