import Pill, { type PillVariante } from '@/components/ui/Pill'

const ROTULO_STATUS: Record<string, string> = {
  aberto:  'Aberto',
  ganho:   'Ganho',
  perdido: 'Perdido',
}

const VARIANTE: Record<string, PillVariante> = {
  aberto:  'accent',
  ganho:   'ok',
  perdido: 'erro',
}


export default function BadgeStatus({ status }: { status: string }) {
  return (
    <Pill variante={VARIANTE[status] ?? 'neutro'}>{ROTULO_STATUS[status] ?? status}</Pill>
  )
}
