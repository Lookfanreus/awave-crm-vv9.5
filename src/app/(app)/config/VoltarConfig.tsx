import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import estilos from './VoltarConfig.module.css'


export default function VoltarConfig() {
  return (
    <Link href="/config" className={estilos.voltar}>
      <ChevronLeft size={16} strokeWidth={2} />
      Configurações
    </Link>
  )
}
