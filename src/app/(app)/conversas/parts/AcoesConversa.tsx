'use client'
import { useState } from 'react'
import { Archive, Target, Undo2 } from 'lucide-react'
import { aceitaAtribuicao, avisoDeArquivada, podeArquivar, podeDevolver } from '@/lib/canais/assumir'
import Botao from '@/components/ui/Botao'
import { Selecao } from '@/components/ui/Campo'
import type { Atendente } from '@/server/canais/inbox-leitura'
import type { ConversaLista } from '@/server/canais/leitura'
import estilos from '../conversas.module.css'


export default function AcoesConversa({
  conversa,
  atendentes,
  aviso,
  aoAtribuir,
  aoArquivar,
  aoVirarNegocio,
}: {
  conversa: ConversaLista
  atendentes: Atendente[]
  
  aviso: string | null
  aoAtribuir: (membroId: string | null) => Promise<string | null>
  aoArquivar: () => Promise<string | null>
  aoVirarNegocio: () => Promise<string | null>
}) {
  
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  
  
  const devolver = podeDevolver(conversa)
  
  const atribuivel = aceitaAtribuicao(conversa.status)
  const arquivavel = podeArquivar(conversa.status)
  const arquivada = avisoDeArquivada(conversa.status)

  
  async function correr(acao: () => Promise<string | null>): Promise<void> {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      const falha = await acao()
      if (falha) setErro(falha)
    } catch {
      setErro(
        'Algo deu errado nesta tela. Recarregue a página para ver como esta conversa está — a ação pode ter sido gravada.',
      )
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className={estilos.barraConversa}>
      <div className={estilos.barraLinha}>
        {}
        <h2 className={estilos.tituloConversa}>{conversa.contatoNome ?? conversa.chaveExterna}</h2>

        <div className={estilos.barraAcoes}>
          <label className={estilos.rotuloAtribuir} htmlFor="atribuir-conversa">
            Assumir
          </label>
          <Selecao
            id="atribuir-conversa"
            className={estilos.selecaoAtribuir}
            title={
              atribuivel
                ? 'Escolher uma pessoa cala o assistente nesta conversa.'
                : 'Conversa arquivada: ninguém pode assumi-la enquanto ela estiver aqui.'
            }
            value={conversa.atribuidaA ?? ''}
            
            
            
            
            
            disabled={ocupado || !atribuivel}
            onChange={(e) => void correr(() => aoAtribuir(e.target.value || null))}
          >
            <option value="">Ninguém</option>
            {atendentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.rotulo}
              </option>
            ))}
            {}
            {conversa.atribuidaA && !atendentes.some((a) => a.id === conversa.atribuidaA) ? (
              <option value={conversa.atribuidaA}>Membro que saiu da equipe</option>
            ) : null}
          </Selecao>

          {}
          {devolver ? (
            <Botao
              type="button"
              onClick={() => void correr(() => aoAtribuir(null))}
              carregando={ocupado}
              title="O assistente volta a responder esta conversa."
            >
              <Undo2 size={16} strokeWidth={2} />
              Devolver ao assistente
            </Botao>
          ) : null}

          <Botao type="button" onClick={() => void correr(aoVirarNegocio)} carregando={ocupado}>
            <Target size={16} strokeWidth={2} />
            Virar negócio
          </Botao>

          {}
          {arquivavel ? (
            <Botao type="button" onClick={() => void correr(aoArquivar)} carregando={ocupado}>
              <Archive size={16} strokeWidth={2} />
              Arquivar
            </Botao>
          ) : null}
        </div>
      </div>

      {}
      {arquivada ? (
        <p className={estilos.avisoAcao} role="status">
          {arquivada}
        </p>
      ) : null}

      {erro ? (
        <p className={estilos.erroAcao} role="status">
          {erro}
        </p>
      ) : null}

      {}
      {aviso ? (
        <p className={estilos.avisoAcao} role="status">
          {aviso}
        </p>
      ) : null}
    </div>
  )
}
