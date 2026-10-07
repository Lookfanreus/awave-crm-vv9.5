'use client'

import { Pencil } from 'lucide-react'
import { useDrawer, type OpcoesCrm } from './DrawerProvider'
import Botao from '@/components/ui/Botao'


export default function BotaoEditar({
  registro,
  opcoes,
  tipo = 'negocio',
}: {
  registro: Record<string, unknown> & { id: string }
  opcoes?: OpcoesCrm
  tipo?: 'negocio' | 'contato' | 'empresa'
}) {
  const { abrirEdicao } = useDrawer()

  return (
    <Botao type="button" onClick={() => abrirEdicao(tipo, registro, opcoes)}>
      <Pencil size={14} />
      Editar
    </Botao>
  )
}
