# `custom/tarefas/` — código seu rodando sozinho

Um arquivo `.ts` por tarefa. O CRM roda cada uma de tempos em tempos, sem ninguém precisar
abrir o sistema — serve para sincronizar com outro sistema, mandar um resumo diário, ou deixar
um agente de IA trabalhando.

## O mínimo que funciona

```ts
// custom/tarefas/sincronizar.ts
export const cada = '15m'          // opcional; sem isso, roda de hora em hora

export default async function sincronizar() {
  await fetch('https://meu-erp.exemplo/sync', { method: 'POST' })
}
```

Pronto. Na próxima vez que o servidor bater o relógio (a cada ~30 segundos ele confere se
alguma tarefa está na hora), ela roda.

## `cada` — de quanto em quanto tempo

`'90s'`, `'15m'`, `'2h'`, `'1d'`. O **mínimo é 1 minuto**: pedir menos que isso é pedir "toda
vez", e o servidor confere as tarefas a cada ~30 segundos. Escrito errado (`'toda hora'`), vale
o padrão de 1 hora — não dá erro, só roda menos vezes do que você queria.

## Com banco

```ts
import { clienteSemIsolamento } from '@awave/custom/servidor'

const MEU_WORKSPACE = 'cole-aqui-o-id-do-seu-espaco-de-trabalho'

export const cada = '1d'

export default async function limpar() {
  const db = clienteSemIsolamento()
  // ⚠️ Aqui não há ninguém logado, então o banco não sabe de qual espaço de trabalho é o
  // dado. O filtro é seu — sem ele, você mexe no dado de todos os clientes do servidor.
  await db.from('meus_contratos').delete().eq('workspace_id', MEU_WORKSPACE).lt('criado_em', '2026-01-01')
}
```

## Os limites, e por que eles existem

- **10 segundos por tarefa.** Passou disso, o CRM para de esperar e vai para a próxima. Sua
  tarefa continua rodando, mas o resultado dela é ignorado — então **use timeout no seu
  `fetch`**: `fetch(url, { signal: AbortSignal.timeout(8000) })`.
- **20 segundos para todas juntas**, e menos que isso se o servidor já estiver ocupado. O que
  não coube fica para a próxima volta. Isso é de propósito: a mesma batida que roda suas
  tarefas também entrega os webhooks e confere a licença, e nada seu pode atrasar isso.
- **Se a sua tarefa falhar, ela não é repetida na hora** — espera o intervalo normal. Uma
  tarefa quebrada não pode ficar tentando a cada 30 segundos para sempre.
- **O erro vai para o log do servidor** (EasyPanel → Logs), não para a tela de ninguém.

⚠️ **A extensão tem que ser `.ts`** e o nome só aceita letras minúsculas, números e hífen.
