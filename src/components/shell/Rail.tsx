import { Fragment } from 'react'
import {
  LayoutGrid, LayoutDashboard, Target, CalendarClock, BarChart3,
  Contact, Building2, Settings, Zap, MessageSquare, BookOpen,
  Wallet, FileText, Package, Truck, Receipt, Users,
  Bot, Boxes, ClipboardList, Landmark, Sparkles, Puzzle,
} from 'lucide-react'
import { lerMenuCustom } from '@/server/custom/menu'
import { ICONE_PADRAO, type IconePermitido } from '@/lib/menu-custom'
import estilos from './Rail.module.css'
import ItemNav from './ItemNav'
import SeletorWorkspace, { type WorkspaceOpcao } from './SeletorWorkspace'
import MenuUsuario, { type UsuarioResumo } from './MenuUsuario'
import MarcaLockup from '@/components/MarcaLockup'
import { lerMarca } from '@/server/marca'
import { temaDaRequisicao } from '@/server/tema'




const ICONES: Record<IconePermitido, React.ReactNode> = {
  Wallet: <Wallet size={16} strokeWidth={2} />,
  FileText: <FileText size={16} strokeWidth={2} />,
  Package: <Package size={16} strokeWidth={2} />,
  Truck: <Truck size={16} strokeWidth={2} />,
  Receipt: <Receipt size={16} strokeWidth={2} />,
  Users: <Users size={16} strokeWidth={2} />,
  Bot: <Bot size={16} strokeWidth={2} />,
  Boxes: <Boxes size={16} strokeWidth={2} />,
  ClipboardList: <ClipboardList size={16} strokeWidth={2} />,
  Landmark: <Landmark size={16} strokeWidth={2} />,
  Sparkles: <Sparkles size={16} strokeWidth={2} />,
  Puzzle: <Puzzle size={16} strokeWidth={2} />,
}

function iconeDe(nome: IconePermitido): React.ReactNode {
  return ICONES[nome] ?? ICONES[ICONE_PADRAO]
}

export default async function Rail({ user, wsAtivo, workspaces, avisoAtualizacao = false }: {
  user: UsuarioResumo
  wsAtivo: string
  workspaces: WorkspaceOpcao[]
  
  avisoAtualizacao?: boolean
}) {
  const marca = await lerMarca()
  
  
  
  
  const tema = await temaDaRequisicao()

  
  
  const itensCustom = await lerMenuCustom()
  const porGrupo = new Map<string, typeof itensCustom>()
  for (const item of itensCustom) {
    const lista = porGrupo.get(item.grupo)
    if (lista) lista.push(item)
    else porGrupo.set(item.grupo, [item])
  }
  const grupos = [...porGrupo.entries()]

  return (
    <aside className={estilos.rail}>
      <div className={estilos.marca}>
        <MarcaLockup
          logo={marca.logo}
          nome={marca.nome}
          classeTile={estilos.tile}
          classeLogo={estilos.logo}
          tamanhoGlifo={16}
        />
        <div className={estilos.marcaTexto}>
          <b>{marca.nome}</b>
        </div>
      </div>

      {}
      <div className={estilos.topo}>
        <SeletorWorkspace workspaces={workspaces} wsAtivo={wsAtivo} />
      </div>

      {}
      <div className={estilos.grupos}>
        <div className={estilos.sec}>Dia a dia</div>
        {}
        <ItemNav href="/painel" rotulo="Painel"><LayoutDashboard size={16} strokeWidth={2} /></ItemNav>
        <ItemNav href="/negocios" rotulo="Negócios"><Target size={16} strokeWidth={2} /></ItemNav>
        <ItemNav href="/agenda" rotulo="Agenda"><CalendarClock size={16} strokeWidth={2} /></ItemNav>
        {}
        <ItemNav href="/conversas" rotulo="Conversas"><MessageSquare size={16} strokeWidth={2} /></ItemNav>

        <div className={estilos.sec}>Cadastros</div>
        <ItemNav href="/contatos" rotulo="Contatos"><Contact size={16} strokeWidth={2} /></ItemNav>
        <ItemNav href="/empresas" rotulo="Empresas"><Building2 size={16} strokeWidth={2} /></ItemNav>
        {}
        <ItemNav href="/base-conhecimento" rotulo="Base de conhecimento"><BookOpen size={16} strokeWidth={2} /></ItemNav>

        {}
        <div className={estilos.sec}>Automação e análise</div>
        <ItemNav href="/automacoes" rotulo="Automações"><Zap size={16} strokeWidth={2} /></ItemNav>
        {}
        <ItemNav href="/agentes" rotulo="Agentes de IA"><Bot size={16} strokeWidth={2} /></ItemNav>
        <ItemNav href="/relatorios" rotulo="Relatórios"><BarChart3 size={16} strokeWidth={2} /></ItemNav>

        {}
        {grupos.map(([grupo, itens]) => (
          <Fragment key={grupo}>
            <div className={estilos.sec}>{grupo}</div>
            {itens.map((item) => (
              <ItemNav key={item.caminho} href={item.caminho} rotulo={item.titulo}>
                {iconeDe(item.icone)}
              </ItemNav>
            ))}
          </Fragment>
        ))}
      </div>

      <div className={estilos.rodape}>
        {}
        {}
        <ItemNav href="/config" rotulo="Configurações" aviso={avisoAtualizacao}><Settings size={16} strokeWidth={2} /></ItemNav>
        <MenuUsuario user={user} tema={tema} />
      </div>
    </aside>
  )
}
