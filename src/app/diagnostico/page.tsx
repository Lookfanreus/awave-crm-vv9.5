import type { CSSProperties } from 'react'
import { Check, X, LayoutGrid } from 'lucide-react'
import { validarConfig } from '../../../config-deploy.mjs'
import base from '@/app/(auth)/auth.module.css'
import estilos from './diagnostico.module.css'
import mov from '@/app/movimento.module.css'
import SeletorTema from '@/components/ui/SeletorTema'
import { temaDaRequisicao } from '@/server/tema'
import { tituloDaPagina, lerMarca } from '@/server/marca'




export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return { title: await tituloDaPagina('Configuração pendente') }
}

type Item = { codigo: string; campo: string; titulo: string; comoResolver: string }

export default async function Diagnostico() {
  const marca = await lerMarca()
  
  
  
  
  
  const tema = await temaDaRequisicao().catch(() => 'escuro' as const)
  const r = validarConfig(process.env)
  const campos = [
    { nome: 'SUPABASE_DB_URL', rotulo: 'Endereço do banco (Session pooler)' },
    { nome: 'SUPABASE_ANON_KEY', rotulo: 'Chave pública (anon)' },
    { nome: 'SUPABASE_SERVICE_ROLE_KEY', rotulo: 'Chave secreta (service_role)' },
  ]
  
  
  
  
  const orfaos: Item[] = r.problemas.filter(
    (p: Item) => !campos.some((c) => c.nome === p.campo),
  )
  const avisos: Item[] = r.avisos

  return (
    <main className={base.tela}>
      <div className={`${base.cardLargo} ${mov.entra}`}>
        <div className={base.marca}>
          <span className={base.tile}><LayoutGrid size={20} strokeWidth={2} /></span>
          <b>{marca.nome}</b>
        </div>

        <h1 className={base.titulo}>Falta configurar o seu CRM</h1>
        <p className={base.sub}>
          Preencha as variáveis abaixo na aba <b>Environment</b> do EasyPanel e clique em{' '}
          <b>Deploy</b> de novo. Esta tela some sozinha quando estiver tudo certo.
        </p>

        {r.todasAusentes && (
          <p className={estilos.recuperacao}>
            Se este CRM já funcionava, as variáveis de ambiente foram apagadas. Basta
            recolocá-las — nada foi perdido, seus dados continuam no Supabase.
          </p>
        )}

        <div className={estilos.bloco}>
          <h2 className={estilos.blocoCab}>Variáveis de ambiente</h2>
          <ul className={estilos.lista}>
            {campos.map((c, i) => {
              
              
              
              const doCampo: Item[] = r.problemas.filter((p: Item) => p.campo === c.nome)
              const ok = doCampo.length === 0
              return (
                <li
                  key={c.nome}
                  className={`${estilos.item} ${mov.entra} ${mov.escalona}`}
                  style={{ '--i': i + 1 } as CSSProperties}
                >
                  <span className={ok ? estilos.marcaOk : estilos.marcaErro} aria-hidden="true">
                    {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                  <div className={estilos.corpo}>
                    <div className={estilos.rotulo}>{c.rotulo}</div>
                    <code className={estilos.varNome}>{c.nome}</code>
                    {doCampo.map((p) => (
                      <div key={p.codigo} className={estilos.problema}>
                        <div className={estilos.problemaTitulo}>{p.titulo}</div>
                        <div className={estilos.comoResolver}>{p.comoResolver}</div>
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {orfaos.length > 0 && (
          <div className={estilos.bloco}>
            <h2 className={estilos.blocoCab}>Ainda falta resolver</h2>
            {orfaos.map((p) => (
              <div key={p.codigo} className={estilos.orfao}>
                <code className={estilos.varNomeAlerta}>{p.campo}</code>
                <div className={estilos.problemaTitulo}>{p.titulo}</div>
                <div className={estilos.comoResolver}>{p.comoResolver}</div>
              </div>
            ))}
          </div>
        )}

        {avisos.length > 0 && (
          <div className={estilos.bloco}>
            <h2 className={estilos.blocoCab}>Avisos (não impedem o CRM de subir)</h2>
            {avisos.map((a) => (
              <div key={a.codigo} className={estilos.aviso}>
                <code className={estilos.varNomeAlerta}>{a.campo}</code>
                <div className={estilos.problemaTitulo}>{a.titulo}</div>
                <div className={estilos.comoResolver}>{a.comoResolver}</div>
              </div>
            ))}
          </div>
        )}

        <p className={estilos.rodape}>
          Nenhum valor de variável é exibido nesta página — só se ela está preenchida e
          se o formato bate.
        </p>
      </div>

      <SeletorTema tema={tema} />
    </main>
  )
}
