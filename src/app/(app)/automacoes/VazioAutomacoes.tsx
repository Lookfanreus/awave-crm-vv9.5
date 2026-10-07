import Link from 'next/link'
import { Zap, ArrowRight, Plus } from 'lucide-react'
import { TEMPLATES } from '@/lib/automacao-templates'
import estilos from './automacoes.module.css'


export default function VazioAutomacoes() {
  return (
    <section className={estilos.vazioTela}>
      <span className={estilos.vazioIcone}>
        <Zap size={22} strokeWidth={1.75} />
      </span>
      <h2 className={estilos.vazioTitulo}>Deixe o CRM fazer o repetitivo</h2>
      <p className={estilos.vazioTexto}>
        Uma automação é uma regra do tipo <strong>quando isso acontecer, faça aquilo</strong> —
        avisar alguém, criar uma tarefa, mover um negócio. Comece por um modelo pronto:
      </p>

      <div className={estilos.vazioModelos}>
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/automacoes?editar=novo&modelo=${encodeURIComponent(t.id)}`}
            className={estilos.vazioModelo}
          >
            <span className={estilos.vazioModeloNome}>{t.nome}</span>
            <span className={estilos.vazioModeloDesc}>{t.descricao}</span>
            <span className={estilos.vazioModeloAcao}>
              Usar este modelo <ArrowRight size={14} strokeWidth={2} />
            </span>
          </Link>
        ))}
      </div>

      <Link href="/automacoes?editar=novo" className={estilos.vazioDoZero}>
        <Plus size={15} strokeWidth={2} /> Prefiro criar do zero
      </Link>

      <p className={estilos.vazioNota}>
        Toda automação nasce <strong>desligada</strong> — você liga quando ela estiver do jeito
        que quer. O motor confere a cada ~30 segundos, então ela age em até 1 minuto depois do
        gatilho.
      </p>
    </section>
  )
}
