import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import estilos from './VoltarAgentes.module.css'


export default function VoltarAgentes() {
  return (
    <Link href="/agentes" className={estilos.voltar}>
      <ChevronLeft size={16} strokeWidth={2} />
      Agentes de IA
    </Link>
  )
}
