import { corDoNome, iniciaisDoNome } from '@/lib/avatar'
import estilos from './Avatar.module.css'


export default function Avatar({
  nome,
  tamanho = 'md',
  rotulo,
}: {
  nome: string
  
  tamanho?: 'sm' | 'md'
  
  rotulo?: string
}) {
  const { de, para } = corDoNome(nome)
  return (
    <span
      className={`${estilos.avatar}${tamanho === 'sm' ? ` ${estilos.sm}` : ''}`}
      
      style={{ backgroundImage: `linear-gradient(145deg, ${de}, ${para})` }}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      title={rotulo}
      aria-hidden={rotulo ? undefined : true}
    >
      {iniciaisDoNome(nome)}
    </span>
  )
}
