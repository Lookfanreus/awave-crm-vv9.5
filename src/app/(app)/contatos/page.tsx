import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Search, Users } from 'lucide-react'
import { exigirSessao } from '@/server/auth/sessao'
import { criarClienteServidor } from '@/server/supabase-session'
import { resolverWorkspaceAtivo } from '@/server/auth/workspace-ativo'
import { listarContatos } from '@/server/crm/listas'
import { opcoesForm } from '@/server/crm/acoes'
import Tabela from '@/app/(app)/_crm/Tabela'
import BotaoNovo from '@/app/(app)/_crm/BotaoNovo'
import Paginacao from '@/app/(app)/_crm/Paginacao'
import Botao from '@/components/ui/Botao'
import estilos from '@/app/(app)/_crm/crm.module.css'
import CabecalhoPagina from '@/components/ui/CabecalhoPagina'
import EstadoVazio from '@/components/ui/EstadoVazio'
import Avatar from '@/components/ui/Avatar'
import { tituloDaPagina } from '@/server/marca'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Contatos') }
}

const COLUNAS = [
  { chave: 'nome',     rotulo: 'Nome' },
  { chave: 'email',    rotulo: 'E-mail' },
  { chave: 'telefone', rotulo: 'Telefone' },
  { chave: 'empresa',  rotulo: 'Empresa' },
  { chave: 'origem',   rotulo: 'Origem' },
]

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


export default async function ContatosPage({
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

  const [pagina, opcoes] = await Promise.all([
    listarContatos(cliente, ws, { busca: busca || undefined, p }),
    opcoesForm(),
  ])

  const linhas = pagina.itens.map((c) => ({
    id: c.id,
    href: `/contatos/${c.id}`,
    celulas: [
      
      
      
      <span key="nome" className={estilos.celulaNome}>
        <Avatar nome={c.nome} tamanho="sm" />
        <span>{c.nome}</span>
      </span>,
      c.email ?? '—',
      c.telefone ?? '—',
      c.empresaNome ?? '—',
      c.origem ? capitalizar(c.origem) : '—',
    ],
  }))

  return (
    <div className={estilos.listaLayout}>
      <CabecalhoPagina titulo="Contatos" acoes={
        <div className={estilos.listaAcoes}>
          <form className={estilos.buscaForm} action="/contatos" method="get">
            <span className={estilos.buscaWrap}>
              <Search className={estilos.buscaIcone} size={14} aria-hidden />
              <input
                className={estilos.buscaInput}
                type="search"
                name="busca"
                defaultValue={busca}
                placeholder="Buscar por nome…"
                aria-label="Buscar contatos por nome"
              />
            </span>
          </form>
          <BotaoNovo tipo="contato" rotulo="Novo contato" opcoes={opcoes} />
        </div>
      } />

      <Tabela
        colunas={COLUNAS}
        linhas={linhas}
        
        
        
        vazio={busca ? (
          <EstadoVazio
            icone={<Search size={20} />}
            titulo={`Nada encontrado para "${busca}"`}
            texto="A busca compara pelo nome. Confira a grafia ou limpe o filtro para ver todos."
            acao={<Botao href="/contatos">Limpar busca</Botao>}
          />
        ) : (
          <EstadoVazio
            icone={<Users size={20} />}
            titulo="Nenhum contato ainda"
            texto="Contatos são as pessoas com quem você fala. Crie o primeiro e ele já pode ser ligado a um negócio."
            acao={<BotaoNovo tipo="contato" rotulo="Novo contato" opcoes={opcoes} />}
          />
        )}
      />

      <Paginacao base="/contatos" busca={busca} p={p} temMais={pagina.temMais} />
    </div>
  )
}
