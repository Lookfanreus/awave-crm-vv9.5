'use client'

import { useState, useTransition, useRef } from 'react'
import { Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  salvarNomeDaMarca, salvarCorDaMarca, enviarLogo, enviarFavicon,
  removerImagem, restaurarMarcaPadrao,
} from './acoes-marca'
import { excedeLimite } from '@/lib/marca-arquivo'
import Botao from '@/components/ui/Botao'
import { Entrada } from '@/components/ui/Campo'
import estilos from './config.module.css'

type Vista = { nome: string; accent: string; logo: string | null; favicon: string | null }
type Res = { ok: true } | { erro: string; medido?: number }


export default function MarcaCard({ inicial }: { inicial: Vista }) {
  const router = useRouter()
  const [nome, setNome] = useState(inicial.nome)
  const [cor, setCor] = useState(inicial.accent)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const refLogo = useRef<HTMLInputElement>(null)
  const refFavicon = useRef<HTMLInputElement>(null)
  
  
  
  const [nomeLogo, setNomeLogo] = useState<string | null>(null)
  const [nomeFavicon, setNomeFavicon] = useState<string | null>(null)

  
  const [ultimoInicial, setUltimoInicial] = useState(inicial)
  if (inicial !== ultimoInicial) {
    setUltimoInicial(inicial)
    setNome(inicial.nome)
    setCor(inicial.accent)
  }

  function aplicar(r: Res, sucesso: string) {
    if ('erro' in r) {
      setOk(null)
      setErro(
        r.erro === 'nao_autorizado' ? 'Só o dono deste servidor pode mudar a marca.'
        : r.erro === 'nome_vazio' ? 'Escreva o nome antes de salvar.'
        : r.erro === 'nome_longo' ? 'Nome muito longo — use até 40 caracteres.'
        
        
        
        
        
        : r.erro === 'contraste_baixo' ? `Essa cor é clara demais: ela dá ${String(r.medido).replace('.', ',')}:1 contra o branco, e o mínimo é 4,5:1. Com ela, o texto branco dos botões ficaria ilegível. Escolha um tom mais escuro.`
        : r.erro === 'hex_invalido' ? 'Cor em formato inválido. Use algo como #3D5AFE.'
        : r.erro === 'tipo_invalido' ? 'Formato não aceito. Envie PNG, JPG ou WEBP.'
        : r.erro === 'arquivo_grande' ? 'Imagem muito pesada — o limite é 512 KB.'
        : r.erro === 'sem_arquivo' ? 'Escolha um arquivo antes de enviar.'
        : r.erro === 'falha_ao_enviar' ? 'Não consegui enviar a imagem. Tente de novo.'
        : 'Não consegui salvar. Tente de novo.',
      )
      return
    }
    setErro(null)
    setOk(sucesso)
    
    
    router.refresh()
  }

  function enviar(qual: 'logo' | 'favicon') {
    const input = qual === 'logo' ? refLogo.current : refFavicon.current
    const arquivo = input?.files?.[0]
    if (!arquivo) { setErro('Escolha um arquivo antes de enviar.'); return }
    
    
    
    
    
    
    
    
    
    if (excedeLimite(arquivo.size)) { aplicar({ erro: 'arquivo_grande' }, ''); return }
    const dados = new FormData()
    dados.append('arquivo', arquivo)
    iniciar(async () => {
      const r = qual === 'logo' ? await enviarLogo(dados) : await enviarFavicon(dados)
      aplicar(r, qual === 'logo' ? 'Logo enviado.' : 'Favicon enviado.')
      if (input) input.value = ''
      if (qual === 'logo') setNomeLogo(null); else setNomeFavicon(null)
    })
  }

  return (
    <section className={estilos.bloco}>
      <div className={estilos.blocoCab}>
        <h2 className={estilos.blocoTitulo}>Marca</h2>
        <span className={estilos.blocoMeta}>Vale para o servidor inteiro</span>
      </div>

      <p className={estilos.ajuda}>
        Nome, logo, ícone da aba e cor aparecem no menu, na tela de entrada e no título da
        janela. <strong>Isto sobrevive à atualização em um clique</strong> — não precisa
        editar arquivo nenhum.
      </p>

      {}
      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="marca-nome">Nome do sistema</label>
        <div className={estilos.linhaForm}>
          <Entrada
            id="marca-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            disabled={pendente}
          />
          <Botao variante="primario"
            carregando={pendente} desabilitado={!nome.trim() || nome === inicial.nome}
            onClick={() => iniciar(async () => aplicar(await salvarNomeDaMarca(nome), 'Nome salvo.'))}
          >
            Salvar
          </Botao>
        </div>
      </div>

      {}
      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="marca-cor">Cor principal</label>
        <div className={estilos.linhaForm}>
          {}
          <Entrada
            id="marca-cor"
            type="color"
            style={{ maxWidth: 56, padding: 2 }}
            value={/^#[0-9A-Fa-f]{6}$/.test(cor) ? cor : '#3D5AFE'}
            onChange={(e) => setCor(e.target.value.toUpperCase())}
            disabled={pendente}
            aria-label="Escolher a cor principal"
          />
          <Entrada
            value={cor}
            onChange={(e) => setCor(e.target.value.toUpperCase())}
            placeholder="#3D5AFE"
            spellCheck={false}
            disabled={pendente}
            aria-label="Cor principal em hexadecimal"
          />
          <Botao variante="primario"
            carregando={pendente} desabilitado={cor === inicial.accent}
            onClick={() => iniciar(async () => aplicar(await salvarCorDaMarca(cor), 'Cor salva.'))}
          >
            Salvar
          </Botao>
        </div>
        <p className={estilos.ajuda}>
          Cores muito claras são recusadas: o texto dos botões é branco, e sobre um fundo
          claro ele desaparece.
        </p>
      </div>

      {}
      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="marca-logo">
          Logo{' '}
          {inicial.logo ? <span className={`${estilos.selo} ${estilos.selo_ok}`}>enviado</span> : null}
        </label>
        {inicial.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={inicial.logo} alt="Logo atual" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        ) : null}
        <div className={estilos.arquivoLinha}>
          <input
            id="marca-logo"
            ref={refLogo}
            type="file"
            className={estilos.arquivoInput}
            accept="image/png,image/jpeg,image/webp"
            disabled={pendente}
            onChange={(e) => setNomeLogo(e.target.files?.[0]?.name ?? null)}
          />
          <label htmlFor="marca-logo" className={estilos.botaoArquivo}>
            <Upload size={14} strokeWidth={1.75} />
            Escolher imagem
          </label>
          <span className={estilos.arquivoNome} data-vazio={nomeLogo ? 'nao' : 'sim'} title={nomeLogo ?? undefined}>
            {nomeLogo ?? 'Nenhum arquivo escolhido'}
          </span>
          <Botao variante="primario" carregando={pendente} desabilitado={!nomeLogo} onClick={() => enviar('logo')}>
            Enviar
          </Botao>
        </div>
        <p className={estilos.ajuda}>
          PNG, JPG ou WEBP, até 512 KB. Quadrado funciona melhor — o espaço no menu é
          quadrado, e a imagem é encaixada inteira, sem cortar.
        </p>
        {inicial.logo ? (
          <div className={estilos.acoes}>
            <Botao variante="fantasma" tamanho="pequeno" tom="erro"
              carregando={pendente}
              onClick={() => iniciar(async () => aplicar(await removerImagem('logo'), 'Logo removido.'))}
            >
              Remover logo
            </Botao>
          </div>
        ) : null}
      </div>

      {}
      <div className={estilos.campo}>
        <label className={estilos.rotulo} htmlFor="marca-favicon">
          Ícone da aba{' '}
          {inicial.favicon ? <span className={`${estilos.selo} ${estilos.selo_ok}`}>enviado</span> : null}
        </label>
        {}
        {inicial.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={inicial.favicon} alt="Ícone atual" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        ) : null}
        <div className={estilos.arquivoLinha}>
          <input
            id="marca-favicon"
            ref={refFavicon}
            type="file"
            className={estilos.arquivoInput}
            accept="image/png,image/jpeg,image/webp"
            disabled={pendente}
            onChange={(e) => setNomeFavicon(e.target.files?.[0]?.name ?? null)}
          />
          <label htmlFor="marca-favicon" className={estilos.botaoArquivo}>
            <Upload size={14} strokeWidth={1.75} />
            Escolher imagem
          </label>
          <span className={estilos.arquivoNome} data-vazio={nomeFavicon ? 'nao' : 'sim'} title={nomeFavicon ?? undefined}>
            {nomeFavicon ?? 'Nenhum arquivo escolhido'}
          </span>
          <Botao variante="primario" carregando={pendente} desabilitado={!nomeFavicon} onClick={() => enviar('favicon')}>
            Enviar
          </Botao>
        </div>
        <p className={estilos.ajuda}>
          É a imagenzinha que aparece na aba do navegador. Quadrada e pequena (32×32 ou
          64×64) é o ideal.
        </p>
        {inicial.favicon ? (
          <div className={estilos.acoes}>
            <Botao variante="fantasma" tamanho="pequeno" tom="erro"
              carregando={pendente}
              onClick={() => iniciar(async () => aplicar(await removerImagem('favicon'), 'Ícone removido.'))}
            >
              Remover ícone
            </Botao>
          </div>
        ) : null}
      </div>

      <div className={estilos.acoes}>
        <Botao variante="fantasma" tamanho="pequeno" tom="erro"
          carregando={pendente}
          onClick={() => iniciar(async () => aplicar(await restaurarMarcaPadrao(), 'Marca restaurada.'))}
        >
          Restaurar nome e cor originais
        </Botao>
      </div>

      {ok ? <p className={estilos.frase} role="status">{ok}</p> : null}
      {erro ? <p className={estilos.erro} role="alert">{erro}</p> : null}
    </section>
  )
}
