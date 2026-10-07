'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, BarChart3 } from 'lucide-react'
import { ROTULO_TIPO, type TipoRelatorio } from '@/lib/relatorios'
import { removerRelatorio } from './actions'
import Botao from '@/components/ui/Botao'
import estilos from './relatorios.module.css'

export type LinhaSalvo = { id: string; nome: string; tipo: TipoRelatorio }


export default function ListaSalvos({ relatorios, selecionadoId }: {
  relatorios: LinhaSalvo[]
  selecionadoId?: string | null
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function excluir(id: string) {
    setErro(null)
    iniciar(async () => {
      const r = await removerRelatorio(id)
      if ('erro' in r) { setErro('Não foi possível excluir. Tente novamente.'); return }
      
      
      
      if (id === selecionadoId) router.push('/relatorios')
      else router.refresh()
    })
  }

  return (
    <section className={estilos.gestor}>
      {}
      <div className={estilos.blocoTopo}>
        <h2 className={estilos.subtitulo}>Relatórios salvos</h2>
        {relatorios.length > 0 && <span className={estilos.meta}>{relatorios.length}</span>}
      </div>
      {relatorios.length === 0 ? (
        <p className={estilos.vazioLateral}>
          Nenhum ainda. Monte a pergunta ao lado, dê um nome e salve — ela reabre com os mesmos
          filtros sempre que o time precisar.
        </p>
      ) : (
        <ul className={estilos.lista}>
          {relatorios.map((r) => (
            <li key={r.id} className={`${estilos.item} ${r.id === selecionadoId ? estilos.itemAtivo : ''}`}>
              <Link href={`/relatorios/${r.id}`} className={estilos.itemNome} title={r.nome}>
                {}
                <span className={estilos.itemTopo}>
                  <BarChart3 size={15} strokeWidth={1.75} />
                  <span className={estilos.itemLabel}>{r.nome}</span>
                </span>
                <span className={estilos.itemSub}>{ROTULO_TIPO[r.tipo]}</span>
              </Link>
              <Botao variante="fantasma" tamanho="pequeno" tom="erro" soIcone type="button" carregando={pendente}
                title="Excluir relatório" aria-label={`Excluir ${r.nome}`}
                onClick={() => excluir(r.id)}>
                <Trash2 size={14} strokeWidth={1.75} />
              </Botao>
            </li>
          ))}
        </ul>
      )}
      {erro && <p className={estilos.erro}>{erro}</p>}
    </section>
  )
}
