# `custom/eventos/` — reagir ao que acontece no CRM

Um arquivo `.ts` por evento, com o nome do evento. Quando aquilo acontece no CRM, o seu código
roda — sem você ficar consultando o banco de tempos em tempos.

## Os eventos disponíveis

| Arquivo | Quando dispara | O que vem no `payload` |
|---|---|---|
| `lead-novo.ts` | um contato é criado | `contato` (id, nome, email, telefone, origem, empresa_id) |
| `deal-novo.ts` | um negócio é criado | `negocio` (id, titulo, valor, status, etapa_id, pipeline_id, …) |
| `etapa-mudou.ts` | um negócio muda de etapa | `negocio` (id, titulo, pipeline_id), `de_etapa_id`, `para_etapa_id` |
| `deal-ganho.ts` | um negócio é marcado como ganho | `negocio` (id, titulo, valor, status) |
| `deal-perdido.ts` | um negócio é marcado como perdido | `negocio` (…, motivo_perda) |
| `lead-excluido.ts` | um contato é apagado | `contato` (id, nome, email, …) |
| `deal-excluido.ts` | um negócio é apagado | `negocio` (id, titulo, valor, …) |

Os dois últimos são disparados **depois** de o registro sair do banco — o `payload` é o
retrato dele no instante da exclusão, e é a única cópia que você vai ter.

O nome do arquivo usa **hífen**, mesmo que o evento apareça com `_` em outros lugares.

## O mínimo que funciona

```ts
// custom/eventos/etapa-mudou.ts
export default async function ({ tipo, workspaceId, payload }) {
  console.log('mudou de etapa:', tipo, workspaceId, payload)
}
```

## Um caso real

```ts
// custom/eventos/deal-ganho.ts
import { clienteSemIsolamento } from '@awave/custom/servidor'

export default async function ({ workspaceId, payload }: {
  workspaceId: string
  payload: { negocio: { id: string; titulo: string; valor: number | null } }
}) {
  const db = clienteSemIsolamento()
  // O workspaceId vem DO EVENTO: é ele que você usa no filtro.
  await db.from('meus_contratos').insert({
    workspace_id: workspaceId,
    negocio_id: payload.negocio.id,
    titulo: payload.negocio.titulo,
  })
}
```

## O que vale saber

- **Não é instantâneo.** O CRM confere a fila a cada ~30 segundos, então o seu código roda
  poucos segundos depois do fato — não no mesmo instante.
- **Você só recebe o que acontecer DEPOIS de o arquivo existir.** Criar um handler hoje não
  entrega o que aconteceu ontem, e isso é de propósito: seria uma enxurrada de eventos
  antigos chegando como se fossem novos.
- **Evento sem arquivo é descartado sem erro.** Se você só tem `deal-ganho.ts`, os outros
  seis tipos passam direto.
- **Se o seu handler falhar, o CRM tenta de novo**, com intervalos crescentes, até 8 vezes.
  Depois desiste e registra o último erro. O log fica no servidor (EasyPanel → Logs).
- 🔴 **Escreva o handler para poder rodar duas vezes com o mesmo evento.** São 10 segundos
  por evento, e passado o limite o CRM **para de esperar mas não cancela o seu código**: se o
  seu `insert` levar 11 segundos, ele completa E o evento é retentado — e aí você tem duas
  linhas. Antes de gravar, confira se já existe (uma coluna com o id do negócio e um índice
  único resolvem), e use `AbortSignal.timeout(8000)` no seu `fetch`.

⚠️ **A extensão tem que ser `.ts`.**
