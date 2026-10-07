import Link from 'next/link'
import { redirect } from 'next/navigation'
import MarcaLockup from '@/components/MarcaLockup'
import { lerMarca, tituloDaPagina } from '@/server/marca'
import { registrar } from '@/server/auth/registrar'
import { aceitarConvite } from '@/server/auth/convites'
import { ehInstalacaoNova } from '@/server/auth/instalacao'
import { entrar } from '@/server/auth/sessao'
import CampoSenha from '../CampoSenha'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada } from '@/components/ui/Campo'
import SeletorTema from '@/components/ui/SeletorTema'
import { temaDaRequisicao } from '@/server/tema'
import estilos from '../auth.module.css'
import mov from '@/app/movimento.module.css'



export async function generateMetadata() {
  return { title: await tituloDaPagina('Criar conta') }
}

const MENSAGENS: Record<string, string> = {
  cadastro_fechado: 'Cadastro fechado neste servidor. Peça um convite ao administrador.',
  falha_criar_usuario: 'Não foi possível criar a conta. O e-mail já pode estar em uso.',
  falha_criar_workspace: 'Conta criada, mas houve falha ao preparar o espaço de trabalho.',
  falha_bootstrap: 'Falha ao verificar o cadastro. Tente novamente.',
  falha_login: 'Conta criada, mas o login automático falhou. Tente entrar.',
  convite_invalido:
    'O convite expirou, já foi usado ou o link está incorreto. Peça um novo ao administrador ' +
    'do espaço de trabalho — ou crie a sua própria conta abaixo.',
  token_bootstrap_invalido: 'Chave do primeiro acesso incorreta. Ela está no log do container (EasyPanel → Logs).',
}

async function acaoCadastrar(formData: FormData): Promise<void> {
  'use server'
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')
  const nomeWorkspace = String(formData.get('nomeWorkspace') ?? '').trim()
  const convite = String(formData.get('convite') ?? '').trim()
  const tokenInformado = String(formData.get('tokenBootstrap') ?? '')

  const voltar = (erro: string) => {
    const qs = new URLSearchParams({ erro })
    if (convite) qs.set('convite', convite)
    
    
    if (formData.get('boasvindas')) qs.set('boasvindas', '1')
    redirect('/cadastrar?' + qs.toString())
  }

  
  
  const r = await registrar({ email, senha, nomeWorkspace, tokenInformado, convite })
  if ('erro' in r) {
    
    
    
    
    if (r.erro === 'convite_invalido') redirect('/cadastrar?erro=convite_invalido')
    return voltar(r.erro)
  }

  
  const login = await entrar({ email, senha })
  if ('erro' in login) return voltar('falha_login')

  
  
  
  
  
  
  
  
  
  if (convite) await aceitarConvite(convite)

  
  
  
  
  
  
  
  
  
  
  redirect('/painel')
}

export default async function CadastrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; convite?: string; boasvindas?: string }>
}) {
  const { erro, convite, boasvindas } = await searchParams
  const temConvite = Boolean(convite)
  const boasVindas = boasvindas === '1' && !temConvite
  
  
  
  
  
  
  
  const primeiroCadastro =
    !temConvite && (erro === 'token_bootstrap_invalido' || (await ehInstalacaoNova()))
  const marca = await lerMarca()
  const tema = await temaDaRequisicao()
  return (
    <div className={estilos.tela}>
      <div className={`${estilos.card} ${mov.entra}`}>
        <div className={estilos.marca}>
          <MarcaLockup
            logo={marca.logo}
            nome={marca.nome}
            classeTile={estilos.tile}
            classeLogo={estilos.logo}
            tamanhoGlifo={20}
          />
          <b>{marca.nome}</b>
        </div>

        <h1 className={estilos.titulo}>
          {}
          {boasVindas ? `Este é o seu ${marca.nome}. Crie a conta do dono.` : 'Criar conta'}
        </h1>
        <p className={estilos.sub}>
          {temConvite
            ? 'Crie sua conta para entrar no espaço de trabalho do convite.'
            : 'Crie sua conta e o espaço de trabalho da sua empresa.'}
        </p>

        {erro && (
          <p className={erro === 'cadastro_fechado' ? estilos.aviso : estilos.erro}>
            {MENSAGENS[erro] ?? 'Não foi possível concluir o cadastro.'}
          </p>
        )}

        <form className={estilos.form} action={acaoCadastrar}>
          {temConvite && <input type="hidden" name="convite" value={convite} />}
          {boasVindas && <input type="hidden" name="boasvindas" value="1" />}

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
            autoComplete="new-password"
            placeholder="mínimo 6 caracteres"
            minLength={6}
            required
          />

          {}
          {!temConvite && (
            <Campo id="nomeWorkspace" rotulo="Nome do espaço de trabalho">
              <Entrada
                name="nomeWorkspace"
                type="text"
                autoComplete="organization"
                placeholder="Minha Empresa"
                required
              />
            </Campo>
          )}

          {primeiroCadastro && (
            <Campo
              id="tokenBootstrap"
              rotulo="Chave do primeiro acesso"
              ajuda="Está no log do container, no EasyPanel → Logs."
            >
              <Entrada
                name="tokenBootstrap"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="ABCDEF123456"
                required
              />
            </Campo>
          )}

          <Botao variante="primario" larguraTotal type="submit" className={estilos.enviar}>
            Criar conta
          </Botao>
        </form>

        <p className={estilos.rodape}>
          Já tem conta?{' '}
          <Link className={estilos.link} href="/entrar">
            Entrar
          </Link>
        </p>
      </div>

      {}
      <SeletorTema tema={tema} />
    </div>
  )
}
