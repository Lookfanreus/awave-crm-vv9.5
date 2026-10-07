import BarraDeAbas from '@/components/ui/BarraDeAbas'
import { hrefDaAba, ROTULO_ABA, type AbaConfig } from '@/lib/config-abas'
import estilos from './config.module.css'


export default function AbasConfig({ abas, ativa }: { abas: AbaConfig[]; ativa: AbaConfig }) {
  return (
    <BarraDeAbas
      abas={abas}
      ativa={ativa}
      rotulo="Seções das configurações"
      href={hrefDaAba}
      rotuloDaAba={(aba) => ROTULO_ABA[aba]}
      classes={{ barra: estilos.abas, aba: estilos.aba, ativa: estilos.abaAtiva }}
    />
  )
}
