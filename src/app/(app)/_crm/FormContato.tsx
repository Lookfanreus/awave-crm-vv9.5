'use client'

import { useState, useTransition } from 'react'
import { salvarContato } from '@/server/crm/acoes'
import { ORIGENS_DE_CANAL } from '@/server/canais/origem-do-canal'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada, Selecao, AreaTexto } from '@/components/ui/Campo'
import estilos from './crm.module.css'

type Opcoes = { contatos: { id: string; nome: string }[]; empresas: { id: string; nome: string }[] }

interface Props {
  registro?: {
    id: string
    nome?: string | null
    email?: string | null
    telefone?: string | null
    origem?: string | null
    empresa_id?: string | null
    notas?: string | null
  }
  opcoes?: Opcoes
  onSalvo: () => void
}


const ORIGENS = ['inbound', 'outbound', 'referral', 'evento', 'outro']


const ROTULO_DE_CANAL: Record<string, string> = Object.assign(Object.create(null), {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
})


const rotuloDoCanal = (o: string) => `${ROTULO_DE_CANAL[o] ?? o} (veio pelo canal)`


export default function FormContato({ registro, opcoes, onSalvo }: Props) {
  const [nome, setNome] = useState(registro?.nome ?? '')
  const [email, setEmail] = useState(registro?.email ?? '')
  const [telefone, setTelefone] = useState(registro?.telefone ?? '')
  const [origem, setOrigem] = useState(registro?.origem ?? '')
  const [empresaId, setEmpresaId] = useState(registro?.empresa_id ?? '')
  const [notas, setNotas] = useState(registro?.notas ?? '')
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErroMsg(null)
    iniciar(async () => {
      const r = await salvarContato({
        id: registro?.id,
        nome: nome.trim() || undefined,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        origem: origem || null,
        empresa_id: empresaId || null,
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

      <Campo id="c-nome" rotulo="Nome *">
        <Entrada
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do contato"
          required
        />
      </Campo>

      <Campo id="c-email" rotulo="E-mail">
        <Entrada
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@empresa.com"
        />
      </Campo>

      <Campo id="c-telefone" rotulo="Telefone">
        <Entrada
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="+55 11 99999-9999"
        />
      </Campo>

      <Campo id="c-origem" rotulo="Origem">
        <Selecao
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
        >
          <option value="">Selecionar origem</option>
          {ORIGENS.map((o) => (
            <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
          ))}
          {}
          {ORIGENS_DE_CANAL.map((o) => (
            <option key={o} value={o} disabled>{rotuloDoCanal(o)}</option>
          ))}
        </Selecao>
      </Campo>

      <Campo id="c-empresa" rotulo="Empresa">
        <Selecao
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
        >
          <option value="">Nenhuma</option>
          {(opcoes?.empresas ?? []).map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.nome}</option>
          ))}
        </Selecao>
      </Campo>

      <Campo id="c-notas" rotulo="Notas">
        <AreaTexto
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Observações sobre o contato…"
        />
      </Campo>

      <Botao variante="primario" larguraTotal type="submit" carregando={pendente} className={estilos.salvar}>
        {pendente ? 'Salvando…' : 'Salvar'}
      </Botao>
    </form>
  )
}
