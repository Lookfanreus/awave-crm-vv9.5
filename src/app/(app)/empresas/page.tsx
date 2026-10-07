import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Building2, Search } from 'lucide-react'
import { exigirSessao } from '@/server/auth/sessao'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { listarEmpresas } from '@/server/crm/listas'
import Tabela from '@/app/(app)/_crm/Tabela'
import BotaoNovo from '@/app/(app)/_crm/BotaoNovo'
import Paginacao from '@/app/(app)/_crm/Paginacao'
import Botao from '@/components/ui/Botao'
import estilos from '@/app/(app)/_crm/crm.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import EstadoVazio from '@/components/ui/EstadoVazio'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Empresas') }
}

const COLUNAS = [
  { chave: 'nome',      rotulo: 'Nome' },
  { chave: 'site',      rotulo: 'Site' },
  { chave: 'telefone',  rotulo: 'Telefone' },
  { chave: 'contatos',  rotulo: 'Contatos' },
]


export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; p?: string }>
}) {
  const sp = await searchParams
  const busca = (sp.busca ?? '').trim()
  const pNum = Number(sp.p)
  const p = Number.isFinite(pNum) && pNum > 0 ? Math.floor(pNum) : 0

  await exigirSessao()
  const cliente = await criarClienteServidor()
  const ws = await resolverWorkspaceAtivo({ cliente })
  if (!ws) notFound()

  const pagina = await listarEmpresas(cliente, ws, { busca: busca || undefined, p })

  const linhas = pagina.itens.map((e) => ({
    id: e.id,
    href: `/empresas/${e.id}`,
    celulas: [
      e.nome,
      e.site ?? '—',
      e.telefone ?? '—',
      String(e.numContatos),
    ],
  }))

  return (
    <div className={estilos.listaLayout}>
      <CabecalhoPagina titulo="Empresas" acoes={
        <div className={estilos.listaAcoes}>
          <form className={estilos.buscaForm} action="/empresas" method="get">
            <span className={estilos.buscaWrap}>
              <Search className={estilos.buscaIcone} size={14} aria-hidden />
              <input
                className={estilos.buscaInput}
                type="search"
                name="busca"
                defaultValue={busca}
                placeholder="Buscar por nome…"
                aria-label="Buscar empresas por nome"
              />
            </span>
          </form>
          <BotaoNovo tipo="empresa" rotulo="Nova empresa" />
        </div>
      } />

      <Tabela
        colunas={COLUNAS}
        linhas={linhas}
        vazio={busca ? (
          <EstadoVazio
            icone={<Search size={20} />}
            titulo={`Nada encontrado para "${busca}"`}
            texto="A busca compara pelo nome. Confira a grafia ou limpe o filtro para ver todas."
            acao={<Botao href="/empresas">Limpar busca</Botao>}
          />
        ) : (
          <EstadoVazio
            icone={<Building2 size={20} />}
            titulo="Nenhuma empresa ainda"
            texto="Empresas são as contas para quem você vende. Cada contato e cada negócio pode ser ligado a uma."
            acao={<BotaoNovo tipo="empresa" rotulo="Nova empresa" />}
          />
        )}
      />

      <Paginacao base="/empresas" busca={busca} p={p} temMais={pagina.temMais} />
    </div>
  )
}
