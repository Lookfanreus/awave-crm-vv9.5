import {
  caminho,
  caminhoArea,
  pontoEmPorcento,
  pontosDaSerie,
  sinalDaSerie,
  ultimoPonto,
  type Ponto,
} from '@/lib/sparkline'
import estilos from './Sparkline.module.css'


export default function Sparkline({
  serie,
  cor,
  motivo,
  detalhe,
  altura = 28,
}: {
  
  serie: (number | null)[] | null
  
  cor: string
  
  motivo: string
  
  detalhe?: string
  
  altura?: number
}) {
  
  
  
  const sinal = sinalDaSerie(serie)

  if (sinal !== 'movimento') {
    
    
    
    
    
    const constante = sinal === 'sem-variacao'
    return (
      <div
        className={estilos.vazio}
        style={{ height: `${altura}px` }}
        title={constante ? DETALHE_SEM_VARIACAO : detalhe}
      >
        <span className={estilos.trilho} aria-hidden="true" />
        <span className={estilos.motivo}>{constante ? MOTIVO_SEM_VARIACAO : motivo}</span>
      </div>
    )
  }

  const pontos = pontosDaSerie(serie!, LARGURA, altura - FOLGA * 2)
  const desloca = ([x, y]: Ponto): Ponto => [x, y + FOLGA]
  const pontosNaCaixa = pontos.map((p) => (p == null ? null : desloca(p)))
  const fim = ultimoPonto(pontosNaCaixa)
  const traco = caminho(pontosNaCaixa)
  
  
  const hoje = fim && pontoEmPorcento(fim, LARGURA, altura)

  return (
    
    
    
    
    <div
      className={estilos.plot}
      style={{ height: `${altura}px`, '--cor-serie': cor } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg
        className={estilos.svg}
        viewBox={`0 0 ${LARGURA} ${altura}`}
        preserveAspectRatio="none"
        focusable="false"
      >
        {}
        <defs>
          <linearGradient id={`spark-${idDoTraco(traco)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cor} stopOpacity="0.10" />
            <stop offset="1" stopColor={cor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className={estilos.area}
          d={caminhoArea(pontosNaCaixa, altura)}
          fill={`url(#spark-${idDoTraco(traco)})`}
        />
        {}
        {}
        <path
          className={estilos.linha}
          d={traco}
          fill="none"
          stroke={cor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {}
      {hoje && (
        <span className={estilos.hoje} style={{ left: `${hoje.x}%`, top: `${hoje.y}%` }} />
      )}
    </div>
  )
}


const MOTIVO_SEM_VARIACAO = 'sem variação no período'


const DETALHE_SEM_VARIACAO =
  'Houve dado em todos os dias do período e ele foi sempre o mesmo — o número acima é esse ' +
  'valor. Uma série constante desenha um segmento horizontal de ponta a ponta da caixa, que ' +
  'num cartão com um número grande logo acima lê como filete de layout ou barra de progresso, ' +
  'não como medição. A frase afirma o mesmo fato sem se disfarçar de decoração.'


const LARGURA = 100


const FOLGA = 4


function idDoTraco(d: string): string {
  let h = 0
  for (let i = 0; i < d.length; i++) h = (Math.imul(31, h) + d.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
