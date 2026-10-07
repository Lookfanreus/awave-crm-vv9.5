import { redirect } from 'next/navigation'
import { LayoutGrid } from 'lucide-react'
import { exigirSessao } from '@/server/auth/sessao'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { motivoDeBloqueioAtual } from '@/server/license/bloqueio'
import { copyDoBloqueio } from '@/lib/licenca-copy'
import Pill from '@/components/ui/Pill'
import AcoesLicenca from './AcoesLicenca'
import TrocarChave from './TrocarChave'
import SairDaqui from './SairDaqui'



import base from '@/app/(auth)/auth.module.css'
import estilos from './licenca.module.css'
import mov from '@/app/movimento.module.css'
import SeletorTema from '@/components/ui/SeletorTema'
import { temaDaRequisicao } from '@/server/tema'
import { tituloDaPagina, lerMarca } from '@/server/marca'



export async function generateMetadata() {
  return { title: await tituloDaPagina('Licença') }
}

export default async function LicencaPage() {
  const marca = await lerMarca()
  
  
  
  await exigirSessao()

  const motivo = await motivoDeBloqueioAtual()
  
  
  if (!motivo) redirect('/painel')

  
  
  
  
  
  
  const ehDono = await ehDonoDoDeploy().catch(() => false)
  const copy = copyDoBloqueio(motivo, ehDono)
  const tema = await temaDaRequisicao()

  return (
    <main className={base.tela}>
      <div className={`${base.card} ${mov.entra}`}>
        {}
        <div className={base.marca}>
          <div className={base.tile}><LayoutGrid size={20} strokeWidth={2} /></div>
          <b>{marca.nome}</b>
        </div>

        {}
        <div className={estilos.selo}>
          <Pill variante="neutro">{copy.selo}</Pill>
        </div>

        <h1 className={base.titulo}>{copy.titulo}</h1>
        <p className={base.sub}>{copy.acao}</p>

        {}
        {copy.podeRevalidar && <AcoesLicenca />}

        {}
        {ehDono && <TrocarChave />}

        {}
        <SairDaqui />
      </div>

      {}
      <SeletorTema tema={tema} />
    </main>
  )
}
