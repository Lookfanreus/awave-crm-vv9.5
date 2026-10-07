import { LayoutGrid } from 'lucide-react'


export default function MarcaLockup({
  logo,
  nome,
  classeTile,
  classeLogo,
  tamanhoGlifo,
}: {
  
  logo: string | null
  nome: string
  
  classeTile: string
  
  classeLogo: string
  tamanhoGlifo: number
}) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={nome} className={classeLogo} />
  }
  return (
    <div className={classeTile}>
      <LayoutGrid size={tamanhoGlifo} strokeWidth={2} />
    </div>
  )
}
