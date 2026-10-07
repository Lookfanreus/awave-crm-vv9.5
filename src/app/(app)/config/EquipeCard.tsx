'use client'

import { useState, useTransition } from 'react'
import { Copy, Check } from 'lucide-react'
import { gerarConvite, cancelarConvite, type VistaEquipe } from './acoes-equipe'
import Botao from '@/components/ui/Botao'
import { Entrada, Selecao } from '@/components/ui/Campo'
import estilos from './config.module.css'


export default function EquipeCard({ inicial }: { inicial: VistaEquipe }) {
  const [vista, setVista] = useState(inicial)
  const [papel, setPapel] = useState<'owner' | 'membro'>('membro')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aplicar(r: { ok: true; vista: VistaEquipe } | { erro: string }) {
    if ('erro' in r) {
      setErro(
        r.erro === 'nao_autorizado' ? 'Só quem é dono deste espaço de trabalho pode convidar.'
        : r.erro === 'sem_workspace' ? 'Escolha um espaço de trabalho primeiro.'
        : r.erro === 'papel_invalido' ? 'Escolha um tipo de acesso válido.'
        : 'Não consegui. Tente de novo.',
      )
      return
    }
    setErro(null)
    setEmail('')
    setVista(r.vista)
  }

  async function copiar(link: string) {
    
    
    
    const completo = `${window.location.origin}${link}`
    try {
      await navigator.clipboard.writeText(completo)
      setCopiado(link)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      
      
      setErro(completo)
    }
  }

  return (
    <section className={estilos.bloco}>
      {}
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Pessoas</h2>
        <span className={estilos.blocoMeta}>
          Quem tem acesso a este espaço de trabalho
        </span>
      </div>

      <ul className={estilos.lista}>
        {vista.membros.map((m, i) => (
          <li key={i} className={estilos.item}>
            <span>{m.email ?? 'conta sem e-mail'}</span>
            {}
            <span className={`${estilos.selo} ${estilos.selo_neutro}`}>
              {m.papel === 'owner' ? 'dono' : 'membro'}
            </span>
          </li>
        ))}
      </ul>

      {vista.souOwner ? (
        <>
          <div className={estilos.campo}>
            <label className={estilos.rotulo} htmlFor="convite-email">Convidar alguém</label>
            <div className={estilos.linhaForm}>
              <Entrada
                id="convite-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail da pessoa (opcional)"
                autoComplete="off"
                disabled={pendente}
              />
              <Selecao
                
                value={papel}
                onChange={(e) => setPapel(e.target.value as 'owner' | 'membro')}
                disabled={pendente}
                aria-label="Tipo de acesso"
              >
                <option value="membro">Membro</option>
                <option value="owner">Dono</option>
              </Selecao>
              <Botao variante="primario"
                carregando={pendente}
                onClick={() => iniciar(async () => aplicar(await gerarConvite(papel, email)))}
              >
                Gerar link
              </Botao>
            </div>
          </div>
          <p className={estilos.ajuda}>
            O e-mail é só para você lembrar de quem é o convite — nada é enviado por você
            daqui. Você copia o link e manda por onde preferir. <strong>Dono</strong> pode
            convidar e cancelar um convite que ainda não foi usado; <strong>membro</strong>
            não. Tirar deste espaço quem já entrou ainda não dá para fazer por aqui.
          </p>

          {vista.convitesAbertos.length > 0 ? (
            <>
              <p className={estilos.rotulo}>Convites em aberto</p>
              <ul className={estilos.lista}>
                {vista.convitesAbertos.map((c) => (
                  <li key={c.link} className={estilos.item}>
                    <span>
                      {c.email ?? 'sem e-mail'}{' '}
                      <span className={`${estilos.selo} ${estilos.selo_neutro}`}>
                        {c.papel === 'owner' ? 'dono' : 'membro'}
                      </span>
                    </span>
                    <span className={estilos.acoes}>
                      <Botao variante="fantasma" tamanho="pequeno" carregando={pendente} onClick={() => copiar(c.link)}>
                        {copiado === c.link ? (
                          <><Check size={14} strokeWidth={1.75} /> copiado</>
                        ) : (
                          <><Copy size={14} strokeWidth={1.75} /> copiar link</>
                        )}
                      </Botao>
                      <Botao variante="fantasma" tamanho="pequeno" tom="erro"
                        carregando={pendente}
                        onClick={() =>
                          iniciar(async () =>
                            aplicar(await cancelarConvite(c.link.replace('/convite/', ''))),
                          )
                        }
                      >
                        Cancelar
                      </Botao>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={estilos.ajuda}>
                <strong>Trate o link como uma senha.</strong> Quem tiver ele entra neste
                espaço de trabalho. Ele vale por 7 dias, e some depois de usado — se mandou
                para a pessoa errada, cancele aqui.
              </p>
            </>
          ) : null}
        </>
      ) : null}

      {erro ? <p className={estilos.erro} role="alert">{erro}</p> : null}
    </section>
  )
}
