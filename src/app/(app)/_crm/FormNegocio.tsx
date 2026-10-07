'use client'

import { useState, useTransition } from 'react'
import { salvarNegocio } from '@/server/crm/acoes'
import Botao from '@/components/ui/Botao'
import { Campo, Entrada, Selecao, AreaTexto } from '@/components/ui/Campo'
import estilos from './crm.module.css'

type Opcoes = {
  contatos: { id: string; nome: string }[]
  empresas: { id: string; nome: string }[]
  funis: { id: string; nome: string; is_padrao: boolean }[]
  pessoas: { id: string; nome: string }[]
}

interface Props {
  registro?: {
    id: string
    titulo?: string | null
    valor?: number | string | null   
    previsao_fechamento?: string | null
    contato_id?: string | null
    empresa_id?: string | null
    responsavel_id?: string | null
  }
  opcoes?: Opcoes
  onSalvo: () => void
}


export default function FormNegocio({ registro, opcoes, onSalvo }: Props) {
  const criando = !registro?.id
  const funis = opcoes?.funis ?? []
  
  const funilPadrao = funis.find((f) => f.is_padrao)?.id ?? funis[0]?.id ?? ''

  const [titulo, setTitulo] = useState(registro?.titulo ?? '')
  const [valor, setValor] = useState<string>(
    registro?.valor != null ? String(registro.valor) : ''
  )
  const [previsao, setPrevisao] = useState(registro?.previsao_fechamento ?? '')
  const [contatoId, setContatoId] = useState(registro?.contato_id ?? '')
  const [empresaId, setEmpresaId] = useState(registro?.empresa_id ?? '')
  const [funilId, setFunilId] = useState(funilPadrao)
  
  
  
  
  const [responsavelId, setResponsavelId] = useState(registro?.responsavel_id ?? '')
  const [erroMsg, setErroMsg] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErroMsg(null)
    iniciar(async () => {
      const valorNum = valor.trim() !== '' ? Number(valor) : null
      const r = await salvarNegocio({
        id: registro?.id,
        titulo: titulo.trim() || undefined,
        valor: valorNum,
        
        
        previsao_fechamento: previsao.trim() || null,
        contato_id: contatoId || null,
        empresa_id: empresaId || null,
        pipeline_id: registro?.id ? undefined : (funilId || undefined),
        
        
        
        
        responsavel_id: responsavelId || (registro?.id ? null : undefined),
      })
      if ('erro' in r) {
        const msgs: Record<string, string> = {
          titulo_obrigatorio: 'O título é obrigatório.',
          sem_pipeline: 'Nenhum pipeline configurado para este espaço de trabalho.',
          sem_etapa: 'O pipeline não tem etapas. Adicione pelo menos uma etapa antes.',
          pipeline_invalido: 'Funil inválido. Recarregue e tente de novo.',
          responsavel_invalido: 'Essa pessoa não é mais membro deste espaço de trabalho. Recarregue e tente de novo.',
        }
        setErroMsg(msgs[r.erro] ?? 'Não foi possível salvar. Tente novamente.')
      } else {
        onSalvo()
      }
    })
  }

  return (
    <form className={estilos.form} onSubmit={enviar}>
      {erroMsg && <p className={estilos.erro}>{erroMsg}</p>}

      <Campo id="n-titulo" rotulo="Título *">
        <Entrada
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Contrato anual — Empresa XYZ"
          required
        />
      </Campo>

      <Campo id="n-valor" rotulo="Valor (R$)">
        <Entrada
          type="number"
          min="0"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
        />
      </Campo>

      <Campo id="n-previsao" rotulo="Previsão de fechamento">
        <Entrada
          type="date"
          value={previsao}
          onChange={(e) => setPrevisao(e.target.value)}
        />
        <span className={estilos.ajudaCampo}>Opcional. Alimenta o bloco “Fecha em breve” do painel.</span>
      </Campo>

      {criando && funis.length > 0 && (
        <Campo id="n-funil" rotulo="Funil">
          <Selecao
            value={funilId}
            onChange={(e) => setFunilId(e.target.value)}
          >
            {funis.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </Selecao>
        </Campo>
      )}

      <Campo id="n-contato" rotulo="Contato">
        <Selecao
          value={contatoId}
          onChange={(e) => setContatoId(e.target.value)}
        >
          <option value="">Nenhum</option>
          {(opcoes?.contatos ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </Selecao>
      </Campo>

      <Campo id="n-empresa" rotulo="Empresa">
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

      {}
      {(opcoes?.pessoas?.length ?? 0) > 0 && (
        <Campo
          id="n-responsavel"
          rotulo="Responsável"
          ajuda={criando ? 'Em branco, o negócio fica com você.' : undefined}
        >
          <Selecao
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
          >
            {}
            <option value="">{criando ? 'Você (padrão)' : 'Sem responsável'}</option>
            {(opcoes?.pessoas ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Selecao>
        </Campo>
      )}

      <Botao variante="primario" larguraTotal type="submit" carregando={pendente} className={estilos.salvar}>
        {pendente ? 'Salvando…' : 'Salvar'}
      </Botao>
    </form>
  )
}
