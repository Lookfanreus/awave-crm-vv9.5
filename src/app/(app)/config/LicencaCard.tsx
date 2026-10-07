'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { salvarChaveDeLicenca, revalidarAgora, removerChaveDeLicenca } from './acoes-licenca'
import type { VistaDaLicenca } from '@/server/license/estado'
import { copyDaLicenca, dataCurta } from '@/lib/licenca-copy'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './config.module.css'


export default function LicencaCard({ inicial }: { inicial: VistaDaLicenca }) {
  const [estado, setEstado] = useState(inicial)
  const [chave, setChave] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  const copy = copyDaLicenca(estado.situacao)
  const validade = dataCurta(estado.validaAte)

  
  function aplicar(r: { ok: true; estado: VistaDaLicenca } | { erro: string }) {
    if ('erro' in r) {
      setErro(
        r.erro === 'nao_autorizado' ? 'Só o dono deste servidor pode mexer na licença.'
        : r.erro === 'chave_vazia' ? 'Cole a chave antes de salvar.'
        : r.erro === 'chave_invalida' ? 'Isso não parece uma chave de licença.'
        : 'Não consegui salvar. Tente de novo.',
      )
      return
    }
    setErro(null)
    setChave('')
    setEstado(r.estado)
    router.refresh()
  }

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Licença</h2>
        <span className={estilos.blocoMeta}>Vale para o servidor inteiro</span>
      </div>

      {}
      <p className={estilos.linhaEstado}>
        <span className={`${estilos.selo} ${estilos['selo_' + copy.tom]}`}>{copy.selo}</span>
        <span className={estilos.frase}>{copy.titulo}</span>
      </p>
      {copy.acao ? <p className={estilos.ajuda}>{copy.acao}</p> : null}

      {estado.temChave ? (
        <dl className={estilos.licencaDados}>
          <dt>Chave</dt>
          <dd><code>{estado.mascara}</code></dd>
          {estado.comprador ? (<><dt>Licenciada para</dt><dd>{estado.comprador}</dd></>) : null}
          {validade ? (<><dt>Atualizações até</dt><dd>{validade}</dd></>) : null}
          <dt>Última confirmação</dt>
          <dd>{dataCurta(estado.ultimaResposta) ?? 'ainda não houve'}</dd>
        </dl>
      ) : null}

      <div className={estilos.linhaForm}>
        <Entrada
          type="text"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder={estado.temChave ? 'Colar outra chave…' : 'Colar a chave da licença…'}
          aria-label="Chave da licença"
          
          autoComplete="off"
          spellCheck={false}
          disabled={pendente}
        />
        <Botao variante="primario"
          carregando={pendente} desabilitado={!chave.trim()}
          onClick={() => iniciar(async () => aplicar(await salvarChaveDeLicenca(chave)))}
        >
          Salvar
        </Botao>
      </div>

      {estado.temChave ? (
        <div className={estilos.acoes}>
          <Botao variante="fantasma" tamanho="pequeno"
            carregando={pendente}
            onClick={() => iniciar(async () => aplicar(await revalidarAgora()))}
          >
            <RefreshCw size={14} strokeWidth={1.75} /> Verificar agora
          </Botao>
          <Botao variante="fantasma" tamanho="pequeno" tom="erro"
            carregando={pendente}
            onClick={() => iniciar(async () => aplicar(await removerChaveDeLicenca()))}
          >
            Remover chave
          </Botao>
        </div>
      ) : null}

      {erro ? <p className={estilos.erro} role="alert">{erro}</p> : null}
    </section>
  )
}
