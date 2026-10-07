import { redirect } from 'next/navigation'
import { LayoutGrid } from 'lucide-react'
import Botao from '@/components/ui/Botao'
import { criarClienteServidor } from '@/server/supabase-session'
import { aceitarConvite, conviteEhValido } from '@/server/auth/convites'
import SeletorTema from '@/components/ui/SeletorTema'
import { temaDaRequisicao } from '@/server/tema'
import estilos from '../../(auth)/auth.module.css'
import mov from '@/app/movimento.module.css'
import { tituloDaPagina, lerMarca } from '@/server/marca'



export async function generateMetadata() {
  return { title: await tituloDaPagina('Convite') }
}

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const marca = await lerMarca()

  const sessao = await criarClienteServidor()
  const {
    data: { user },
  } = await sessao.auth.getUser()

  if (user) {
    const r = await aceitarConvite(token)
    if ('ok' in r) redirect('/')
  } else if (await conviteEhValido(token)) {
    
    redirect('/cadastrar?convite=' + encodeURIComponent(token))
  }

  
  
  
  
  
  
  

  
  const tema = await temaDaRequisicao()
  return (
    <div className={estilos.tela}>
      <div className={`${estilos.card} ${mov.entra}`}>
        <div className={estilos.marca}>
          <div className={estilos.tile}><LayoutGrid size={20} strokeWidth={2} /></div>
          <b>{marca.nome}</b>
        </div>

        <h1 className={estilos.titulo}>Convite inválido</h1>
        <p className={estilos.sub}>
          Este convite expirou, já foi usado ou o link está incorreto. Peça um novo ao
          administrador do espaço de trabalho.
        </p>

        {}
        <div className={estilos.acao}>
          <Botao variante="primario" larguraTotal href={user ? '/' : '/entrar'}>
            {user ? 'Ir para o painel' : 'Entrar'}
          </Botao>
        </div>
      </div>

      {}
      <SeletorTema tema={tema} />
    </div>
  )
}
