'use client'

import { Plus } from 'lucide-react'
import { useDrawer, type OpcoesCrm } from './DrawerProvider'
import Botao from '@/components/ui/Botao'


export default function BotaoNovo({
  tipo,
  rotulo,
  opcoes,
}: {
  tipo: 'negocio' | 'contato' | 'empresa'
  rotulo: string
  opcoes?: OpcoesCrm
}) {
  const { abrirNovo } = useDrawer()

  return (
    <Botao variante="primario" type="button" onClick={() => abrirNovo(tipo, opcoes)}>
      <Plus size={16} />
      {rotulo}
    </Botao>
  )
}
