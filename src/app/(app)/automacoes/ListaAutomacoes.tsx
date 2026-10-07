'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Trash2 } from 'lucide-react'
import { alternarAutomacaoAtiva, removerAutomacao } from './actions'
import { traduzErroAutomacao } from '@/lib/automacao-rotulos'
import Botao from '@/components/ui/Botao'
import estilos from './automacoes.module.css'

export type LinhaAutomacao = {
  id: string
  nome: string
  ativo: boolean
  gatilhoLegivel: string
  numAcoes: number
  ultimoResultado: { texto: string; tom: 'ok' | 'erro' | 'neutro' | 'pendente' } | null
}


export default function ListaAutomacoes({
  automacoes, selecionadoId, compacta = false,
}: {
  automacoes: LinhaAutomacao[]
  selecionadoId: string | null
  
  compacta?: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function roda(fn: () => Promise<{ ok: true } | { erro: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if ('erro' in r) setErro(traduzErroAutomacao(r.erro))
      else router.refresh()
    })
  }

  const ligadas = automacoes.filter((a) => a.ativo).length

  return (
    <section className={estilos.gestor}>
      <div className={estilos.blocoTopo}>
        <h2 className={estilos.subtitulo}>Suas automações</h2>
        {}
        {automacoes.length > 0 && (
          <span className={estilos.meta}>{ligadas} de {automacoes.length} ligadas</span>
        )}
      </div>
      {erro && <p className={estilos.erro}>{erro}</p>}

      {}
      {automacoes.length === 0 && <p className={estilos.vazio}>Nenhuma ainda — a que você criar aparece aqui.</p>}

      <ul className={`${estilos.lista} ${compacta ? estilos.listaCompacta : ''}`}>
        {automacoes.map((a) => (
          <li key={a.id} className={`${estilos.item} ${a.id === selecionadoId ? estilos.itemAtivo : ''}`}>
            <button
              type="button"
              role="switch"
              aria-checked={a.ativo}
              aria-label={a.ativo ? `Desligar ${a.nome}` : `Ligar ${a.nome}`}
              className={estilos.switch}
              data-on={a.ativo}
              disabled={pendente}
              onClick={() => roda(() => alternarAutomacaoAtiva(a.id, !a.ativo))}
            >
              <span className={estilos.switchThumb} />
            </button>

            <Link href={`/automacoes?editar=${a.id}`} className={estilos.itemNome}>
              <span className={estilos.itemLabel}>{a.nome}</span>
              {}
              <span className={estilos.itemRegra}>
                <span className={estilos.itemGatilho}>{a.gatilhoLegivel}</span>
                {}
                <ArrowRight className={estilos.itemSeta} size={14} strokeWidth={2} aria-hidden />
                <span className={estilos.itemAcoes}>
                  {a.numAcoes} {a.numAcoes === 1 ? 'ação' : 'ações'}
                </span>
              </span>
            </Link>

            {a.ultimoResultado && (
              <span className={`${estilos.estado} ${estilos['tom_' + a.ultimoResultado.tom]}`}>
                <span className={estilos.estadoPonto} aria-hidden />
                {a.ultimoResultado.texto}
              </span>
            )}

            <Botao variante="fantasma" tamanho="pequeno" tom="erro" soIcone className={estilos.remover} type="button" carregando={pendente}
              title="Excluir automação" aria-label={`Excluir ${a.nome}`}
              onClick={() => roda(() => removerAutomacao(a.id))}>
              <Trash2 size={14} />
            </Botao>
          </li>
        ))}
      </ul>
    </section>
  )
}
