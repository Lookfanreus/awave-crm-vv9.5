'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, Download, Trash2, Upload } from 'lucide-react'
import { enviarAnexo, excluirAnexo, urlDoAnexo, type Anexo } from '@/server/crm/anexos'
import {
  validarAnexo, formatarTamanho, TIPOS_PERMITIDOS, TAMANHO_MAX, ERRO_ANEXO,
} from '@/lib/anexo'
import Botao from '@/components/ui/Botao'
import estilos from './crm.module.css'


export default function Anexos({ negocioId, anexos }: { negocioId: string; anexos: Anexo[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    
    
    
    e.target.value = ''
    if (!f) return

    setErro(null)
    
    
    const v = validarAnexo({ tipo: f.type, tamanho: f.size })
    if (!v.ok) { setErro(ERRO_ANEXO[v.erro] ?? ERRO_ANEXO.falha_enviar); return }

    const dados = new FormData()
    dados.set('negocioId', negocioId)
    dados.set('arquivo', f)
    iniciar(async () => {
      const r = await enviarAnexo(dados)
      if ('erro' in r) setErro(ERRO_ANEXO[r.erro] ?? ERRO_ANEXO.falha_enviar)
      else router.refresh()
    })
  }

  function baixar(id: string) {
    setErro(null)
    iniciar(async () => {
      const r = await urlDoAnexo({ id })
      if ('erro' in r) { setErro(ERRO_ANEXO[r.erro] ?? ERRO_ANEXO.falha_link); return }
      
      
      
      window.location.assign(r.url)
    })
  }

  function excluir(id: string) {
    setErro(null)
    iniciar(async () => {
      const r = await excluirAnexo({ id })
      if ('erro' in r) setErro(ERRO_ANEXO[r.erro] ?? ERRO_ANEXO.falha_excluir)
      else router.refresh()
    })
  }

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Anexos</h2>
        <span className={estilos.blocoMeta}>{anexos.length > 0 ? `${anexos.length}` : null}</span>
      </div>

      <div className={estilos.blocoCorpo}>
        {erro && <p className={estilos.erro} role="alert">{erro}</p>}

        {anexos.length === 0 && !pendente && (
          <p className={estilos.anexoVazio}>
            Nenhum arquivo por aqui. Anexe a proposta, o contrato ou um print.
          </p>
        )}

        {anexos.length > 0 && (
          <ul className={estilos.anexoLista}>
            {anexos.map((a) => (
              <li key={a.id} className={estilos.anexoItem}>
                <Paperclip size={14} strokeWidth={1.75} className={estilos.anexoIcone} aria-hidden />
                <span className={estilos.anexoNome}>{a.nome}</span>
                <span className={estilos.anexoTamanho}>{formatarTamanho(a.tamanho)}</span>
                <Botao type="button" variante="fantasma" soIcone carregando={pendente}
                  aria-label={`Baixar ${a.nome}`} onClick={() => baixar(a.id)}>
                  <Download size={14} strokeWidth={1.75} />
                </Botao>
                <Botao type="button" variante="fantasma" tom="erro" soIcone carregando={pendente}
                  aria-label={`Excluir ${a.nome}`} onClick={() => excluir(a.id)}>
                  <Trash2 size={14} strokeWidth={1.75} />
                </Botao>
              </li>
            ))}
          </ul>
        )}

        {}
        <label className={`${estilos.anexoUpload}${pendente ? ` ${estilos.anexoUploadPendente}` : ''}`}>
          <Upload size={14} strokeWidth={1.75} aria-hidden />
          <span>{pendente ? 'Enviando…' : 'Anexar arquivo'}</span>
          <input
            ref={inputRef}
            type="file"
            hidden
            disabled={pendente}
            accept={TIPOS_PERMITIDOS.join(',')}
            onChange={escolher}
          />
        </label>
        <p className={estilos.anexoAjuda}>
          PDF, PNG, JPEG ou WEBP, até {formatarTamanho(TAMANHO_MAX)}.
        </p>
      </div>
    </section>
  )
}
