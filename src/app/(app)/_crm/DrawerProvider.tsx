'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Drawer from '@/components/ui/Drawer'
import FormContato from './FormContato'
import FormEmpresa from './FormEmpresa'
import FormNegocio from './FormNegocio'
import { opcoesForm } from '@/server/crm/acoes'



type TipoDrawer = 'negocio' | 'contato' | 'empresa'


export type OpcoesCrm = {
  contatos: { id: string; nome: string }[]
  empresas: { id: string; nome: string }[]
  funis: { id: string; nome: string; is_padrao: boolean }[]
  
  pessoas: { id: string; nome: string }[]
}

type RegistroGenerico = Record<string, unknown> & { id: string }

interface EstadoDrawer {
  tipo: TipoDrawer
  registro?: RegistroGenerico
  opcoes?: OpcoesCrm
}

interface DrawerContextValue {
  abrirNovo: (tipo: TipoDrawer, opcoes?: OpcoesCrm) => void
  abrirEdicao: (tipo: TipoDrawer, registro: RegistroGenerico, opcoes?: OpcoesCrm) => void
  fechar: () => void
}



const DrawerContext = createContext<DrawerContextValue | null>(null)

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error('useDrawer deve ser usado dentro de <DrawerProvider>')
  return ctx
}



const TITULOS: Record<TipoDrawer, { novo: string; editar: string }> = {
  negocio: { novo: 'Novo negócio', editar: 'Editar negócio' },
  contato: { novo: 'Novo contato', editar: 'Editar contato' },
  empresa: { novo: 'Nova empresa', editar: 'Editar empresa' },
}




export default function DrawerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoDrawer | null>(null)

  
  async function resolverOpcoes(fornecidas?: OpcoesCrm): Promise<OpcoesCrm> {
    if (fornecidas) return fornecidas
    return opcoesForm()
  }

  const abrirNovo = useCallback(async (tipo: TipoDrawer, opcoes?: OpcoesCrm) => {
    const op = await resolverOpcoes(opcoes)
    setEstado({ tipo, opcoes: op })
  }, [])

  const abrirEdicao = useCallback(async (tipo: TipoDrawer, registro: RegistroGenerico, opcoes?: OpcoesCrm) => {
    const op = await resolverOpcoes(opcoes)
    setEstado({ tipo, registro, opcoes: op })
  }, [])

  const fechar = useCallback(() => setEstado(null), [])

  function aoSalvo() {
    fechar()
    router.refresh()
  }

  
  const titulo = estado
    ? TITULOS[estado.tipo][estado.registro ? 'editar' : 'novo']
    : ''

  
  function renderForm() {
    if (!estado) return null
    switch (estado.tipo) {
      case 'contato':
        return (
          <FormContato
            registro={estado.registro as Parameters<typeof FormContato>[0]['registro']}
            opcoes={estado.opcoes}
            onSalvo={aoSalvo}
          />
        )
      case 'empresa':
        return (
          <FormEmpresa
            registro={estado.registro as Parameters<typeof FormEmpresa>[0]['registro']}
            onSalvo={aoSalvo}
          />
        )
      case 'negocio':
        return (
          <FormNegocio
            registro={estado.registro as Parameters<typeof FormNegocio>[0]['registro']}
            opcoes={estado.opcoes}
            onSalvo={aoSalvo}
          />
        )
    }
  }

  return (
    <DrawerContext.Provider value={{ abrirNovo, abrirEdicao, fechar }}>
      {children}
      <Drawer aberto={estado !== null} titulo={titulo} onFechar={fechar}>
        {renderForm()}
      </Drawer>
    </DrawerContext.Provider>
  )
}
