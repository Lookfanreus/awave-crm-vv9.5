'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { definirRegra, type RegraEtapa } from '@/server/crm/campos-etapa'
import type { CampoCompleto } from '@/server/crm/campos-def'
import { Selecao } from '@/components/ui/Campo'
import estilos from './campos.module.css'

const ERRO_PT: Record<string, string> = {
  invisivel_obrigatorio: 'Um campo escondido não pode ser obrigatório — ninguém conseguiria preencher.',
  sem_workspace: 'Não foi possível identificar seu espaço de trabalho.',
}
function traduz(e: string) { return ERRO_PT[e] ?? 'Não foi possível concluir. Tente novamente.' }


export default function MatrizEtapas({ campos, etapas, regras, funis, funilId }: {
  campos: CampoCompleto[]
  etapas: { id: string; nome: string }[]
  regras: RegraEtapa[]
  funis: { id: string; nome: string }[]
  funilId: string
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const chave = (campoId: string, etapaId: string) => `${campoId}|${etapaId}`
  const mapa = new Map(regras.map((r) => [chave(r.campo_id, r.etapa_id), r]))

  function alterna(campoId: string, etapaId: string, qual: 'obrigatorio' | 'visivel') {
    const atual = mapa.get(chave(campoId, etapaId)) ?? { obrigatorio: false, visivel: true }
    
    
    const proximo = qual === 'obrigatorio'
      ? { obrigatorio: !atual.obrigatorio, visivel: atual.visivel }
      : { obrigatorio: atual.obrigatorio, visivel: !atual.visivel }
    setErro(null)
    iniciar(async () => {
      const r = await definirRegra({ campoId, etapaId, ...proximo })
      if ('erro' in r) setErro(traduz(r.erro))
      else router.refresh()
    })
  }

  if (campos.length === 0 || etapas.length === 0) return null

  return (
    <section className={estilos.cartao}>
      <div className={estilos.matrizTopo}>
        <h2 className={estilos.subtitulo}>Obrigatório por etapa</h2>
        <Selecao value={funilId} aria-label="Funil"
          onChange={(e) => router.push(`/config/campos?entidade=negocio&funil=${e.target.value}`)}>
          {funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </Selecao>
      </div>
      <p className={estilos.ajuda}>
        Marque <strong>Obrigatório</strong> para exigir o preenchimento antes de o negócio
        <em> sair</em> daquela etapa. Desmarque <strong>Visível</strong> para esconder o
        campo enquanto o negócio estiver nela — o valor já preenchido nunca é apagado.
      </p>
      {erro && <p className={estilos.erro}>{erro}</p>}

      <div className={estilos.matrizRolagem}>
        <table className={estilos.matriz}>
          <thead>
            <tr>
              <th scope="col">Campo</th>
              {etapas.map((e) => <th key={e.id} scope="col">{e.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {campos.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.rotulo}</th>
                {etapas.map((e) => {
                  const r = mapa.get(chave(c.id, e.id)) ?? { obrigatorio: false, visivel: true }
                  return (
                    <td key={e.id}>
                      <label className={estilos.check}>
                        <input type="checkbox" checked={r.obrigatorio} disabled={pendente}
                          onChange={() => alterna(c.id, e.id, 'obrigatorio')} />
                        <span>Obrigatório</span>
                      </label>
                      <label className={estilos.check}>
                        <input type="checkbox" checked={r.visivel} disabled={pendente}
                          onChange={() => alterna(c.id, e.id, 'visivel')} />
                        <span>Visível</span>
                      </label>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
