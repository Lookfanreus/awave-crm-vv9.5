import Esqueleto from '@/components/ui/Esqueleto'
import estilos from './loading.module.css'


export default function CarregandoPainel() {
  return (
    
    
    
    <div role="status" aria-label="Carregando o painel" className={estilos.pilha}>
      <div className={estilos.cabecalho}>
        <Esqueleto largura="120px" altura="25px" />
        <Esqueleto largura="360px" />
      </div>

      <div className={estilos.faixaKpi}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={estilos.kpi}>
            <Esqueleto largura="88px" />
            <Esqueleto largura="70%" altura="31px" />
            <Esqueleto largura="60%" />
          </div>
        ))}
      </div>

      {}
      {}
      <div className={estilos.grid}>
        {[0, 1].map((bloco) => (
          <div key={bloco} className={estilos.bloco}>
            <div className={estilos.blocoHead}>
              <Esqueleto largura="150px" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={estilos.linha}>
                <Esqueleto largura="28px" altura="28px" redondo />
                <span className={estilos.linhaTextos}>
                  {}
                  <Esqueleto largura={`${68 - i * 9}%`} />
                  <Esqueleto largura={`${42 - i * 5}%`} />
                </span>
                <Esqueleto largura="76px" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {}
      <div className={estilos.grid}>
        <div className={estilos.bloco}>
          <div className={estilos.blocoHead}>
            <Esqueleto largura="120px" />
          </div>
          {}
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={estilos.linhaFunil}>
              <Esqueleto largura={`${86 - i * 8}px`} />
              <Esqueleto largura="100%" altura="8px" />
              <Esqueleto largura="76px" />
            </div>
          ))}
        </div>

        <div className={estilos.bloco}>
          <div className={estilos.blocoHead}>
            <Esqueleto largura="110px" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className={estilos.linha}>
              <Esqueleto largura="28px" altura="28px" redondo />
              <span className={estilos.linhaTextos}>
                <Esqueleto largura={`${64 - i * 9}%`} />
                <Esqueleto largura={`${40 - i * 5}%`} />
              </span>
              <Esqueleto largura="76px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
