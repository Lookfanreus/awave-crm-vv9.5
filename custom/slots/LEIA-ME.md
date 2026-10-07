# `custom/slots/` — blocos seus dentro das telas do CRM

Um arquivo por **âncora**. O nome do arquivo É a âncora — se o arquivo existir, o bloco
aparece naquele lugar; se não existir, a tela fica como sempre foi.

⚠️ **A extensão tem que ser `.tsx`.** Um arquivo `.ts` ou `.jsx` com o nome certo não é
encontrado, e o bloco simplesmente não aparece — sem erro em lugar nenhum.

## As âncoras disponíveis

| Arquivo | Onde aparece | O que você recebe |
|---|---|---|
| `negocio.detalhe.lateral.tsx` | coluna da direita da tela de um negócio, abaixo dos campos | `{ negocioId }` |
| `contato.detalhe.rodape.tsx` | fim da coluna principal da tela de um contato | `{ contatoId }` |
| `empresa.detalhe.rodape.tsx` | fim da coluna principal da tela de uma empresa | `{ empresaId }` |
| `painel.topo.tsx` | no painel, entre o título e a faixa de números | — |

**Por que contato e empresa são "rodapé" e negócio é "lateral":** a coluna da direita dessas
duas telas **desaparece** quando não há notas nem campos personalizados. Um bloco seu ali
ficaria invisível dependendo do espaço de trabalho, sem nada explicando. Na tela de negócio a
coluna existe sempre.

## O mínimo que funciona

```tsx
// custom/slots/negocio.detalhe.lateral.tsx
export default function MeuBloco({ ctx }: { ctx?: Record<string, string> }) {
  return (
    <section>
      <h3>Contratos deste negócio</h3>
      <p>Negócio: {ctx?.negocioId}</p>
    </section>
  )
}
```

## Buscando dado

```tsx
import { clienteDaSessao } from '@awave/custom'

export default async function MeuBloco({ ctx }: { ctx?: Record<string, string> }) {
  const db = await clienteDaSessao()
  const { data } = await db
    .from('meus_contratos')
    .select('id, titulo')
    .eq('negocio_id', ctx?.negocioId ?? '')

  if (!data?.length) return null   // devolver null é válido: o bloco simplesmente não aparece
  return <ul>{data.map((c) => <li key={c.id}>{c.titulo}</li>)}</ul>
}
```

## O que vale saber

- **Se o seu bloco quebrar, ele some — a tela do CRM continua inteira.** O erro vai pro log
  do servidor, não pra frente do seu vendedor. Se o bloco não aparece e você espera que
  apareça, o log é o primeiro lugar a olhar.
- **`ctx` é o mínimo necessário** (só os identificadores). Se precisar do resto do registro,
  busque no banco a partir do id.
- **A lista de âncoras pode crescer entre versões, mas nenhuma some sem aviso** — elas são
  parte do contrato. Se você precisa de uma que não existe, peça.
