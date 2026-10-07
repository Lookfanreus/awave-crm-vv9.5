'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { salvarHorarioAtendimento } from './acoes'




import { FUSOS, FUSO_PADRAO } from '@/lib/agente/horario-atendimento'
import {
  NOME_DOS_DIAS,
  fraseDoEstado,
  linhasDoFormulario,
  textoDosFeriados,
  type LinhaDoDia,
} from '@/lib/agente/horario-formulario'
import type { PainelDoAgente } from '@/server/agente/painel'
import { avisoDoCusto, formatarTokens, formatarUsd } from '@/lib/custo-formato'
import Botao from '@/components/ui/Botao'
import { AreaTexto, Campo, Entrada, Selecao } from '@/components/ui/Campo'
import estilos from './agentes.module.css'


export default function Atendimento({ inicial }: { inicial: PainelDoAgente }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [fuso, setFuso] = useState(inicial.horario?.fuso ?? FUSO_PADRAO)
  const [linhas, setLinhas] = useState<LinhaDoDia[]>(() => linhasDoFormulario(inicial.horario))
  const [feriados, setFeriados] = useState(() => textoDosFeriados(inicial.horario?.feriados ?? []))
  const trocarLinha = (dia: number, mudanca: Partial<LinhaDoDia>) =>
    setLinhas((atuais) => atuais.map((l) => (l.dia === dia ? { ...l, ...mudanca } : l)))

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await salvarHorarioAtendimento({ fuso, linhas, feriados })
      if ('erro' in r) {
        setErro(r.erro)
        return
      }
      router.refresh()
    })
  }

  const custo = inicial.custo

  return (
    <>
      {}
      <section className={estilos.bloco}>
        <div className={estilos.blocoCab}>
          <h2 className={estilos.blocoTitulo}>Quando a empresa atende</h2>
          {}
          <span className={estilos.blocoMeta}>Vale para este espaço de trabalho</span>
        </div>

        <p className={estilos.ajuda}>
          O assistente responde a qualquer hora, e continua respondendo fora do horário — o que
          muda é que ele passa a dizer quando alguém do time volta. Deixe todos os dias
          desmarcados se não quiser nada disso.
        </p>

        <p className={estilos.estadoAgora} role="status">
          {fraseDoEstado(inicial.atendimentoAgora)}
        </p>

        {}
        <Campo rotulo="Fuso horário">
          <Selecao
            value={fuso}
            disabled={pendente}
            onChange={(e) => setFuso(e.target.value)}
          >
            {FUSOS.map((f) => (
              <option key={f} value={f}>
                {f.replace('America/', '').replace(/_/g, ' ')}
              </option>
            ))}
          </Selecao>
        </Campo>

        {}
        <div className={estilos.campo}>
          <span className={estilos.rotulo}>Dias e horários</span>
          <div className={estilos.dias}>
            {linhas.map((l) => (
              <div key={l.dia} className={estilos.dia}>
                <label className={estilos.diaNome} htmlFor={`dia-${l.dia}`}>
                  <input
                    id={`dia-${l.dia}`}
                    type="checkbox"
                    checked={l.aberto}
                    disabled={pendente}
                    onChange={(e) => trocarLinha(l.dia, { aberto: e.target.checked })}
                  />
                  {NOME_DOS_DIAS[l.dia]}
                </label>
                {l.aberto ? (
                  <span className={estilos.diaHoras}>
                    <Entrada
                      type="time"
                      className={estilos.horaCampo}
                      aria-label={`Abre — ${NOME_DOS_DIAS[l.dia]}`}
                      value={l.inicio}
                      disabled={pendente}
                      onChange={(e) => trocarLinha(l.dia, { inicio: e.target.value })}
                    />
                    <span className={estilos.diaAte}>às</span>
                    <Entrada
                      type="time"
                      className={estilos.horaCampo}
                      aria-label={`Fecha — ${NOME_DOS_DIAS[l.dia]}`}
                      value={l.fim}
                      disabled={pendente}
                      onChange={(e) => trocarLinha(l.dia, { fim: e.target.value })}
                    />
                  </span>
                ) : (
                  <span className={estilos.diaAte}>Fechado</span>
                )}
              </div>
            ))}
          </div>
          {}
          <p className={estilos.ajuda}>
            Se a empresa atende madrugada adentro, escreva o fechamento no horário do dia
            seguinte — 22:00 às 02:00, por exemplo.
          </p>
        </div>

        {}
        <Campo
          rotulo="Feriados e dias fechados"
          ajuda="Uma data por linha, no formato 25/12/2026. Nesses dias a empresa fica fechada o dia inteiro, quaisquer que sejam os horários acima."
        >
          <AreaTexto
            rows={4}
            value={feriados}
            disabled={pendente}
            placeholder={'25/12/2026\n01/01/2027'}
            onChange={(e) => setFeriados(e.target.value)}
          />
        </Campo>

        <Botao variante="primario" type="button" carregando={pendente} onClick={salvar}>
          <Save size={16} strokeWidth={1.75} /> Salvar horário
        </Botao>
        {erro ? (
          <p className={estilos.erro} role="alert">
            {erro}
          </p>
        ) : null}
      </section>

      {}
      {custo ? (
        <section className={estilos.bloco}>
          <div className={estilos.blocoCab}>
            <h2 className={estilos.blocoTitulo}>Quanto custou este mês</h2>
            {}
            <span className={estilos.blocoMeta}>Vale para o servidor inteiro</span>
          </div>

          <div className={estilos.faixaCusto}>
            <div>
              <span className={estilos.rotuloCusto}>Gasto</span>
              <span
                className={`${estilos.valorCusto} ${custo.parcial ? estilos.valorCustoLongo : ''}`}
              >
                {formatarUsd(custo.usd, custo.parcial)}
              </span>
            </div>
            <div>
              <span className={estilos.rotuloCusto}>Respostas</span>
              <span className={estilos.valorCusto}>{formatarTokens(custo.rodadas)}</span>
            </div>
            <div>
              <span className={estilos.rotuloCusto}>Texto lido</span>
              <span className={estilos.valorCusto}>{formatarTokens(custo.tokensEntrada)}</span>
            </div>
            <div>
              <span className={estilos.rotuloCusto}>Texto escrito</span>
              <span className={estilos.valorCusto}>{formatarTokens(custo.tokensSaida)}</span>
            </div>
          </div>

          {custo.porWorkspace && custo.porWorkspace.length > 0 ? (
            <ul className={estilos.listaCusto}>
              {custo.porWorkspace.map((f) => (
                <li key={f.workspaceId} className={estilos.linhaCusto}>
                  <span>{f.nome}</span>
                  <span className={estilos.linhaCustoValor}>
                    {formatarUsd(f.usd, f.parcial)} · {formatarTokens(f.rodadas)} respostas
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {}
          <p className={estilos.notaCusto}>
            Estes números são só para você não tomar susto: quem cobra é a sua conta de
            inteligência artificial, e a fatura dela é a palavra final.{' '}
            {avisoDoCusto({
              usd: custo.usd,
              parcial: custo.parcial,
              
              
              
              parcialPorModelo: custo.parcialPorModelo,
              parcialPorContagem: custo.parcialPorContagem,
              modeloSemPreco: inicial.modeloSemPreco,
            })}
          </p>
        </section>
      ) : null}
    </>
  )
}
