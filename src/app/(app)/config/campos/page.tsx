import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { listarCampos, type Entidade } from '@/server/crm/campos-def'
import { listarRegrasDoFunil, type RegraEtapa } from '@/server/crm/campos-etapa'
import GestorCampos from './GestorCampos'
import MatrizEtapas from './MatrizEtapas'
import estilos from './campos.module.css'
import VoltarConfig from '../VoltarConfig'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Campos') }
}

const ENTIDADES: { chave: Entidade; rotulo: string }[] = [
  { chave: 'negocio', rotulo: 'Negócios' },
  { chave: 'contato', rotulo: 'Contatos' },
  { chave: 'empresa', rotulo: 'Empresas' },
]


export default async function CamposPage({
  searchParams,
}: { searchParams: Promise<{ entidade?: string; funil?: string }> }) {
  const sp = await searchParams
  const entidade: Entidade =
    ENTIDADES.some((e) => e.chave === sp.entidade) ? (sp.entidade as Entidade) : 'negocio'

  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })

  const campos = await listarCampos(entidade)

  const { data: funisRaw } = await cliente.from('pipelines')
    .select('id, nome, is_padrao').eq('workspace_id', ws as string).order('ordem')
  const funis = (funisRaw as { id: string; nome: string; is_padrao: boolean }[] | null) ?? []
  const funilId = funis.find((f) => f.id === sp.funil)?.id ?? funis.find((f) => f.is_padrao)?.id ?? funis[0]?.id

  
  let etapas: { id: string; nome: string; ordem: number }[] = []
  let regras: RegraEtapa[] = []
  if (funilId) {
    const { data: etapasRaw } = await cliente.from('etapas')
      .select('id, nome, ordem')
      .eq('workspace_id', ws as string).eq('pipeline_id', funilId).order('ordem')
    etapas = (etapasRaw as { id: string; nome: string; ordem: number }[] | null) ?? []
    regras = await listarRegrasDoFunil(funilId)
  }

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        acima={<VoltarConfig />}
        titulo="Campos"
        subtitulo="Crie os campos que o seu processo precisa. O nome pode mudar quando quiser — o campo continua o mesmo e nenhum dado se perde."
      />

      <GestorCampos entidade={entidade} entidades={ENTIDADES} campos={campos} funis={funis} />

      {entidade === 'negocio' && funilId && (
        <MatrizEtapas
          campos={campos.filter((c) => c.ativo)}
          etapas={etapas}
          regras={regras}
          funis={funis}
          funilId={funilId}
        />
      )}
    </div>
  )
}
