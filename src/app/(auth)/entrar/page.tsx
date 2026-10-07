import Link from 'next/link'
import { redirect } from 'next/navigation'
import MarcaLockup from '@/components/MarcaLockup'
import { lerMarca, tituloDaPagina } from '@/server/marca'
import { ehInstalacaoNova, podeCadastrarSemConvite } from '@/server/auth/instalacao'
import { entrar } from '@/server/auth/sessao'
import CampoSenha from '../CampoSenha'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada } from '@/components/ui/Campo'
import SeletorTema from '@/components/ui/SeletorTema'
import { temaDaRequisicao } from '@/server/tema'
import estilos from '../auth.module.css'
import mov from '@/app/movimento.module.css'



export async function generateMetadata() {
  return { title: await tituloDaPagina('Entrar') }
}

const MENSAGENS: Record<string, string> = {
  credenciais_invalidas: 'E-mail ou senha incorretos.',
}

async function acaoEntrar(formData: FormData): Promise<void> {
  'use server'
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')
  const r = await entrar({ email, senha })
  if ('erro' in r) redirect('/entrar?erro=' + encodeURIComponent(r.erro))
  
  redirect('/painel')
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  if (await ehInstalacaoNova()) redirect('/cadastrar?boasvindas=1')
  const { erro } = await searchParams
  const marca = await lerMarca()
  const tema = await temaDaRequisicao()
  const podeCriarConta = await podeCadastrarSemConvite()
  return (
    <div className={estilos.tela}>
      <div className={`${estilos.card} ${mov.entra}`}>
        <div className={estilos.marca}>
          {}
          <MarcaLockup
            logo={marca.logo}
            nome={marca.nome}
            classeTile={estilos.tile}
            classeLogo={estilos.logo}
            tamanhoGlifo={20}
          />
          <b>{marca.nome}</b>
        </div>

        <h1 className={estilos.titulo}>Entrar</h1>
        <p className={estilos.sub}>Acesse o painel do seu espaço de trabalho.</p>

        {erro && <p className={estilos.erro}>{MENSAGENS[erro] ?? 'Não foi possível entrar.'}</p>}

        <form className={estilos.form} action={acaoEntrar}>
          <Campo id="email" rotulo="E-mail">
            <Entrada
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              required
            />
          </Campo>

          <CampoSenha
            id="senha"
            name="senha"
            rotulo="Senha"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />

          <Botao variante="primario" larguraTotal type="submit" className={estilos.enviar}>
            Entrar
          </Botao>
        </form>

        {}
        {podeCriarConta ? (
          <p className={estilos.rodape}>
            Não tem conta?{' '}
            <Link className={estilos.link} href="/cadastrar">
              Criar espaço de trabalho
            </Link>
          </p>
        ) : null}
      </div>

      {}
      <SeletorTema tema={tema} />
    </div>
  )
}
