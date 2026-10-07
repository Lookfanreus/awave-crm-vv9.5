
















import {
  ESPERA_DO_SINO,
  abandonarSePendurada,
  aoStatusDoCanal,
  aoTentarLeitura,
  apertarSondagem,
  aposLeitura,
  avisoDaInbox,
  conexaoInicial,
  precisaReconciliar,
  type DesfechoDaLeitura,
  type EstadoDaConexao,
} from './conexao-inbox'


export type Cancelar = () => void


export type Agendar = (fn: () => void, ms: number) => Cancelar


export type Ligacao = { desassinar: () => void }


export type Assinar = (p: {
  onChange: () => void
  aoStatus: (status: string, desassinar: () => void) => void
}) => Ligacao

export type Supervisor = {
  
  pulsar: () => void
  
  aoVoltarAOlhar: () => void
  
  parar: () => void
  
  estado: () => EstadoDaConexao
}

export function criarSupervisor(deps: {
  assinar: Assinar
  agendar: Agendar
  agora: () => number
  estaVisivel: () => boolean
  
  reconciliar: () => Promise<DesfechoDaLeitura>
  
  aoAviso: (aviso: string | null) => void
}): Supervisor {
  let estado = conexaoInicial(deps.agora())
  let parado = false
  let atual: Ligacao | null = null
  let cancelarReconexao: Cancelar | null = null
  let cancelarSino: Cancelar | null = null

  const publicar = () => deps.aoAviso(avisoDaInbox(estado, deps.agora()))

  
  let geracao = 0

  
  const ler = () => {
    if (parado) return
    geracao += 1
    const minha = geracao
    estado = aoTentarLeitura(estado, deps.agora())
    void (async () => {
      let desfecho: DesfechoDaLeitura = 'falhou'
      try {
        desfecho = await deps.reconciliar()
      } catch {
        
        
        desfecho = 'falhou'
      }
      
      if (parado) return
      
      if (minha !== geracao) return
      estado = aposLeitura(estado, { desfecho, agora: deps.agora() })
      publicar()
    })()
  }

  const ligar = () => {
    if (parado) return
    
    
    
    let derrubado = false

    atual = deps.assinar({
      onChange: () => {
        if (parado) return
        
        
        
        
        
        
        
        
        
        
        
        
        cancelarSino?.()
        cancelarSino = deps.agendar(() => {
          cancelarSino = null
          ler()
        }, ESPERA_DO_SINO)
      },
      aoStatus: (status, desassinar) => {
        if (parado) return
        
        if (derrubado) return
        const passo = aoStatusDoCanal(estado, status, deps.agora())
        estado = passo.estado
        if (passo.reconectarEm === null) return
        
        
        derrubado = true
        desassinar()
        cancelarReconexao = deps.agendar(() => {
          cancelarReconexao = null
          ligar()
        }, passo.reconectarEm)
      },
    })
  }

  ligar()

  const pulsar = () => {
    if (parado) return
    const agora = deps.agora()
    
    
    
    const abandonada = abandonarSePendurada(estado, agora)
    if (abandonada !== estado) {
      estado = abandonada
      
      
      geracao += 1
    }

    const vaiLer = precisaReconciliar(estado, { agora, visivel: deps.estaVisivel() })
    
    
    
    
    if (vaiLer) ler()
    else publicar()
  }

  return {
    pulsar,
    aoVoltarAOlhar: () => {
      if (parado) return
      
      
      estado = apertarSondagem(estado)
      pulsar()
    },
    parar: () => {
      parado = true
      cancelarSino?.()
      cancelarSino = null
      cancelarReconexao?.()
      cancelarReconexao = null
      
      
      atual?.desassinar()
      atual = null
    },
    estado: () => estado,
  }
}
