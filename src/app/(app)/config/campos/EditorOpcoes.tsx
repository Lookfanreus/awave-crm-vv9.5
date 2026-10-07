'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { editarOpcoes, type CampoCompleto } from '@/server/crm/campos-def'
import { slugCampo } from '@/lib/slug'
import type { OpcaoCampo } from '@/lib/campos-valor'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './campos.module.css'


export default function EditorOpcoes({ campo, pendente, roda }: {
  campo: CampoCompleto
  pendente: boolean
  roda: (fn: () => Promise<{ ok: true; id?: string } | { erro: string }>) => void
}) {
  const [opcoes, setOpcoes] = useState<OpcaoCampo[]>(campo.opcoes ?? [])
  const [nova, setNova] = useState('')

  
  function salvar(lista: OpcaoCampo[]) {
    const anterior = opcoes
    setOpcoes(lista)
    roda(async () => {
      const r = await editarOpcoes({ id: campo.id, opcoes: lista })
      if ('erro' in r) setOpcoes(anterior)
      return r
    })
  }

  function adicionar() {
    const rotulo = nova.trim()
    if (!rotulo) return
    const id = slugCampo(rotulo, opcoes.map((o) => o.id))
    salvar([...opcoes, { id, rotulo }])
    setNova('')
  }

  return (
    <div className={estilos.opcoes}>
      <span className={estilos.opcoesLabel}>Opções</span>
      <ul className={estilos.opcoesLista}>
        {opcoes.map((o) => (
          <li key={o.id} className={estilos.opcaoChip}>
            {o.rotulo}
            <Botao variante="fantasma" tamanho="pequeno" tom="erro" soIcone type="button" aria-label={`Remover ${o.rotulo}`} carregando={pendente}
              onClick={() => salvar(opcoes.filter((x) => x.id !== o.id))}>
              <X size={14} strokeWidth={1.75} />
            </Botao>
          </li>
        ))}
      </ul>
      <div className={estilos.opcoesNova}>
        <Entrada value={nova} placeholder="Nova opção"
          aria-label="Nova opção" disabled={pendente}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') adicionar() }} />
        <Botao variante="fantasma" tamanho="pequeno" type="button" carregando={pendente} desabilitado={!nova.trim()}
          aria-label="Adicionar opção" onClick={adicionar}>
          <Plus size={16} strokeWidth={1.75} />
        </Botao>
      </div>
    </div>
  )
}
