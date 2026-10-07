import { redirect } from 'next/navigation'
import { LayoutGrid } from 'lucide-react'
import { exigirSessao } from '@/server/auth/sessao'
import { resolverWorkspaceAtivo, COOKIE_WS_ATIVO } from '@/server/auth/workspace-ativo'
import { admin } from '@/server/supabase'





import estilos from '@/app/(auth)/auth.module.css'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada } from '@/components/ui/Campo'
import SeletorTema from '@/components/ui/SeletorTema'
import { temaDaRequisicao } from '@/server/tema'
import mov from '@/app/movimento.module.css'
import { tituloDaPagina, lerMarca } from '@/server/marca'



export async function generateMetadata() {
  return { title: await tituloDaPagina('Criar espaço de trabalho') }
}

const MENSAGENS: Record<string, string> = {
  nome_vazio: 'Dê um nome ao seu espaço de trabalho.',
  falha_criar: 'Não foi possível criar o espaço de trabalho. Tente novamente.',
}

async function criarWorkspace(formData: FormData): Promise<void> {
  'use server'
  const user = await exigirSessao()
  const nome = String(formData.get('nome') ?? '').trim()
  if (!nome) redirect('/sem-workspace?erro=nome_vazio')

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const { data: wsId, error } = await admin().rpc('criar_workspace', { nome, p_dono: user.id })
  if (error || !wsId) redirect('/sem-workspace?erro=falha_criar')

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_WS_ATIVO, wsId as string, { httpOnly: true, sameSite: 'lax', path: '/' })

  redirect('/painel')
}

export default async function SemWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  
  await exigirSessao()
  const jaTem = await resolverWorkspaceAtivo()
  if (jaTem !== null) redirect('/painel')

  const { erro } = await searchParams
  const marca = await lerMarca()
  const tema = await temaDaRequisicao()
  return (
    <div className={estilos.tela}>
      <div className={`${estilos.card} ${mov.entra}`}>
        <div className={estilos.marca}>
          <div className={estilos.tile}><LayoutGrid size={20} strokeWidth={2} /></div>
          <b>{marca.nome}</b>
        </div>

        <h1 className={estilos.titulo}>Crie seu espaço de trabalho</h1>
        <p className={estilos.sub}>
          Você ainda não faz parte de nenhum espaço de trabalho. Crie o primeiro para começar a usar o CRM.
        </p>

        {erro && <p className={estilos.erro}>{MENSAGENS[erro] ?? 'Não foi possível concluir.'}</p>}

        <form className={estilos.form} action={criarWorkspace}>
          <Campo id="nome" rotulo="Nome do espaço de trabalho">
            <Entrada
              name="nome"
              type="text"
              autoComplete="organization"
              placeholder="Minha Empresa"
              required
            />
          </Campo>

          <Botao variante="primario" larguraTotal type="submit" className={estilos.enviar}>
            Criar espaço de trabalho
          </Botao>
        </form>
      </div>

      {}
      <SeletorTema tema={tema} />
    </div>
  )
}
