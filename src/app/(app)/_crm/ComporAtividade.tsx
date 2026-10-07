'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { adicionarAtividade } from '@/server/crm/acoes'
import { deDatetimeLocal } from '@/lib/formato'
import Botao from '@/components/ui/Botao'
import { Entrada, Selecao, AreaTexto } from '@/components/ui/Campo'
import estilos from './crm.module.css'

type TipoOpc = { slug: string; nome: string; natureza: string }


const FALLBACK: TipoOpc[] = [
  { slug: 'nota', nome: 'Nota', natureza: 'nota' },
  { slug: 'ligacao', nome: 'Ligação', natureza: 'atividade' },
  { slug: 'reuniao', nome: 'Reunião', natureza: 'atividade' },
  { slug: 'tarefa', nome: 'Tarefa', natureza: 'atividade' },
  { slug: 'email', nome: 'E-mail', natureza: 'atividade' },
  { slug: 'prazo', nome: 'Prazo', natureza: 'atividade' },
]


export default function ComporAtividade({
  negocioId,
  contatoId,
  tipos,
}: {
  negocioId?: string
  contatoId?: string
  tipos?: TipoOpc[]
}) {
  const router = useRouter()
  const opcoes = tipos && tipos.length > 0 ? tipos : FALLBACK
  const [tipo, setTipo] = useState<string>(opcoes[0]?.slug ?? 'nota')
  const [conteudo, setConteudo] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const agendavel = opcoes.find((o) => o.slug === tipo)?.natureza === 'atividade'

  function enviar() {
    const texto = conteudo.trim()
    if (!texto) { setErro('Escreva algo antes de adicionar.'); return }
    setErro(null)
    iniciar(async () => {
      const r = await adicionarAtividade({
        tipo, conteudo: texto, negocioId, contatoId,
        vencimento: agendavel && vencimento ? deDatetimeLocal(vencimento) : null,
      })
      if ('erro' in r) {
        setErro(r.erro === 'sem_membro'
          ? 'Não foi possível identificar seu usuário no espaço de trabalho.'
          : 'Não foi possível adicionar a atividade. Tente novamente.')
      } else {
        setConteudo('')
        setVencimento('')
        router.refresh()
      }
    })
  }

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Adicionar atividade</h2>
      </div>

      <div className={`${estilos.composerCorpo} ${estilos.blocoCorpo}`}>
        <div className={estilos.composerRow}>
          <Selecao
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            disabled={pendente}
            aria-label="Tipo de atividade"
          >
            {opcoes.map((t) => (
              <option key={t.slug} value={t.slug}>{t.nome}</option>
            ))}
          </Selecao>

          {agendavel && (
            <Entrada
              type="datetime-local"
              className={estilos.composerData}
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              disabled={pendente}
              aria-label="Agendar para (opcional)"
            />
          )}
        </div>

        <AreaTexto
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Descreva a atividade…"
          aria-label="Descrição da atividade"
          disabled={pendente}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar()
          }}
        />

        {erro && <p className={estilos.erro}>{erro}</p>}

        <div className={estilos.composerFooter}>
          <span className={estilos.composerDica}>
            {agendavel ? 'Deixe a data vazia para só registrar' : 'Ctrl+Enter para enviar'}
          </span>
          <Botao
            type="button"
            variante="primario"
            onClick={enviar}
            carregando={pendente}
            desabilitado={!conteudo.trim()}
          >
            {pendente ? 'Adicionando…' : agendavel && vencimento ? 'Agendar' : 'Adicionar'}
          </Botao>
        </div>
      </div>
    </section>
  )
}
