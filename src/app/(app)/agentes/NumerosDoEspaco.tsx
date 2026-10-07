'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Power, PowerOff } from 'lucide-react'
import { atribuirAssistente, desligarAgente, ligarAgente } from './acoes'




import { motivoDeNaoAlternar, quemRespondeNoCanal } from '@/lib/agente/quem-responde'
import type { AssistenteNoPainel, CanalNoPainelDoAgente } from '@/server/agente/painel'
import Botao from '@/components/ui/Botao'
import Pill from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Campo'
import estilos from './agentes.module.css'

type Resultado = { ok: true } | { erro: string }


export default function NumerosDoEspaco({
  canais,
  assistentes,
  ehDono,
  temChave,
}: {
  
  canais: CanalNoPainelDoAgente[] | null
  assistentes: AssistenteNoPainel[]
  
  ehDono: boolean
  temChave: boolean
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const padrao = assistentes.find((a) => a.padrao) ?? null
  
  const donoDoCanal = new Map(
    assistentes.flatMap((a) => (a.canais ?? []).map((c) => [c.id, a] as const)),
  )

  function rodar(acao: () => Promise<Resultado>) {
    setErro(null)
    iniciar(async () => {
      const r = await acao()
      if ('erro' in r) {
        setErro(r.erro)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Onde cada número responde</h2>
        {}
        <span className={estilos.blocoMeta}>Vale para este espaço de trabalho</span>
      </div>

      {}
      {canais === null ? (
        <p className={estilos.vazio}>
          Não consegui ler os números deste espaço de trabalho agora. Recarregue a página.
        </p>
      ) : canais.length === 0 ? (
        <p className={estilos.vazio}>
          Nenhum canal conectado ainda. Conecte um em Configurações → Canais.
        </p>
      ) : (
        <ul className={estilos.numeros}>
          {canais.map((c) => {
            
            
            
            
            const motivoCinza = motivoDeNaoAlternar({ ehDono, temChave, ligado: c.ligado })
            const nome = c.nome.trim() || 'Número sem nome'
            return (
              <li key={c.id} className={estilos.numero}>
                <div className={estilos.numeroInfo}>
                  <div className={estilos.numeroTitulo}>
                    <span className={estilos.numeroNome}>{nome}</span>
                    <Pill variante={c.ligado ? 'ok' : 'neutro'}>
                      {c.ligado ? 'Respondendo' : 'Desligado'}
                    </Pill>
                  </div>
                  {}
                  <span className={estilos.ajuda}>
                    {quemRespondeNoCanal(donoDoCanal.get(c.id) ?? null, padrao)}
                  </span>
                  {}
                  {motivoCinza ? <span className={estilos.ajuda}>{motivoCinza}</span> : null}
                </div>
                <div className={estilos.numeroAcoes}>
                  {}
                  {assistentes.length > 0 ? (
                    <Selecao
                      aria-label={`Quem responde em ${nome}`}
                      disabled={pendente}
                      value={donoDoCanal.get(c.id)?.id ?? ''}
                      onChange={(e) => rodar(() => atribuirAssistente(c.id, e.target.value || null))}
                    >
                      <option value="">Usar o assistente padrão</option>
                      {assistentes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nomeInterno || 'Assistente sem nome'}
                        </option>
                      ))}
                    </Selecao>
                  ) : null}
                  {}
                  <Botao
                    variante="fantasma"
                    tamanho="pequeno"
                    type="button"
                    carregando={pendente}
                    desabilitado={motivoCinza !== null}
                    aria-label={`${c.ligado ? 'Desligar' : 'Ligar'} o assistente em ${nome}`}
                    title={
                      motivoCinza ??
                      (c.ligado
                        ? 'Desligar o assistente neste número'
                        : 'Ligar o assistente neste número')
                    }
                    onClick={() => rodar(() => (c.ligado ? desligarAgente(c.id) : ligarAgente(c.id)))}
                  >
                    {c.ligado ? (
                      <>
                        <PowerOff size={16} strokeWidth={1.75} /> Desligar
                      </>
                    ) : (
                      <>
                        <Power size={16} strokeWidth={1.75} /> Ligar
                      </>
                    )}
                  </Botao>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {erro ? (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      ) : null}

      {}
      <p className={estilos.avisoOpenAi}>
        Ao ligar, o conteúdo das conversas daquele número é enviado para a OpenAI (Estados
        Unidos) para gerar as respostas. Isso inclui o que seus clientes escreverem.
      </p>
    </section>
  )
}
