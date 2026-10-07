import Link from 'next/link'
import { dataRelativa } from '@/lib/formato'
import Botao from '@/components/ui/Botao'
import estilos from './automacoes.module.css'

export type LinhaLog = {
  id: string
  quando: string
  automacaoNome: string
  negocioId: string | null
  negocioTitulo: string | null
  texto: string
  tom: 'ok' | 'erro' | 'neutro' | 'pendente'
}


export default function LogExecucoes({
  linhas, pagina, temProxima, editarAtual,
}: {
  linhas: LinhaLog[]
  pagina: number
  temProxima: boolean
  editarAtual: string
}) {
  const href = (p: number) => `/automacoes?editar=${encodeURIComponent(editarAtual)}&pagina=${p}`

  return (
    <section className={estilos.log}>
      {}
      <div className={estilos.blocoTopo}>
        <h2 className={estilos.subtitulo}>Log de execuções</h2>
        <span className={estilos.meta}>O que cada regra fez — mais recente primeiro</span>
      </div>

      {linhas.length === 0 ? (
        <p className={estilos.vazio}>Nenhuma execução ainda.</p>
      ) : (
        <div className={estilos.tabelaWrap}>
          <table className={estilos.tabela}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Automação</th>
                <th>Negócio</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className={estilos.tdMuted}>{dataRelativa(l.quando)}</td>
                  <td>{l.automacaoNome}</td>
                  <td>
                    {l.negocioId
                      ? <Link href={`/negocios/${l.negocioId}`} className={estilos.linkNegocio}>{l.negocioTitulo ?? 'ver negócio'}</Link>
                      : <span className={estilos.tdMuted}>—</span>}
                  </td>
                  {}
                  <td>
                    <span className={`${estilos.estado} ${estilos['tom_' + l.tom]}`}>
                      <span className={estilos.estadoPonto} aria-hidden />
                      {l.texto}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(pagina > 1 || temProxima) && (
        <div className={estilos.paginacao}>
          {pagina > 1
            ? <Botao href={href(pagina - 1)}>Anterior</Botao>
            : <span />}
          {temProxima && <Botao href={href(pagina + 1)}>Próxima</Botao>}
        </div>
      )}
    </section>
  )
}
