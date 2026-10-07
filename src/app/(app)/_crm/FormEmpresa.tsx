'use client'

import { useState, useTransition } from 'react'
import { salvarEmpresa } from '@/server/crm/acoes'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada, AreaTexto } from '@/components/ui/Campo'
import estilos from './crm.module.css'

interface Props {
  registro?: {
    id: string
    nome?: string | null
    site?: string | null
    telefone?: string | null
    notas?: string | null
  }
  opcoes?: unknown
  onSalvo: () => void
}


export default function FormEmpresa({ registro, onSalvo }: Props) {
  const [nome, setNome] = useState(registro?.nome ?? '')
  const [site, setSite] = useState(registro?.site ?? '')
  const [telefone, setTelefone] = useState(registro?.telefone ?? '')
  const [notas, setNotas] = useState(registro?.notas ?? '')
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErroMsg(null)
    iniciar(async () => {
      const r = await salvarEmpresa({
        id: registro?.id,
        nome: nome.trim() || undefined,
        site: site.trim() || null,
        telefone: telefone.trim() || null,
        notas: notas.trim() || null,
      })
      if ('erro' in r) {
        setErroMsg(r.erro === 'nome_obrigatorio' ? 'O nome é obrigatório.' : 'Não foi possível salvar. Tente novamente.')
      } else {
        onSalvo()
      }
    })
  }

  return (
    <form className={estilos.form} onSubmit={enviar}>
      {erroMsg && <p className={estilos.erro}>{erroMsg}</p>}

      <Campo id="e-nome" rotulo="Nome *">
        <Entrada
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da empresa"
          required
        />
      </Campo>

      <Campo id="e-site" rotulo="Site">
        <Entrada
          type="url"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder="https://empresa.com.br"
        />
      </Campo>

      <Campo id="e-telefone" rotulo="Telefone">
        <Entrada
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="+55 11 99999-9999"
        />
      </Campo>

      <Campo id="e-notas" rotulo="Notas">
        <AreaTexto
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Observações sobre a empresa…"
        />
      </Campo>

      <Botao variante="primario" larguraTotal type="submit" carregando={pendente} className={estilos.salvar}>
        {pendente ? 'Salvando…' : 'Salvar'}
      </Botao>
    </form>
  )
}
