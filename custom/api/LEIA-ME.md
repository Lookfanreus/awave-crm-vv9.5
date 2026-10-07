# `custom/api/` — endereços seus na API

Um arquivo por endereço. O nome do arquivo vira a URL:

```
custom/api/webhook-do-erp.ts   →  /api/custom/webhook-do-erp
custom/api/relatorio.ts        →  /api/custom/relatorio
```

Exporte uma função com o nome do método: `GET`, `POST`, `PUT`, `PATCH` ou `DELETE`. Ela
recebe a `Request` e devolve uma `Response` — é a assinatura padrão do Next, nada nosso.

⚠️ **A extensão tem que ser `.ts`** (não `.tsx`). Com outra extensão o endereço responde
"não encontrado", sem nenhum outro aviso.

## O mínimo que funciona

```ts
// custom/api/relatorio.ts
export async function GET() {
  return Response.json({ ok: true })
}
```

## Recebendo webhook de outro sistema

Esta é a diferença importante desta pasta: **aqui pode não haver ninguém logado.** Quando
quem chama é um sistema de fora, não existe sessão — e sem sessão o banco não sabe de qual
espaço de trabalho é o dado. Nesse caso:

```ts
import { clienteSemIsolamento } from '@awave/custom/servidor'

const MEU_SEGREDO = process.env.MEU_SEGREDO ?? ''
const MEU_WORKSPACE = 'cole-aqui-o-id-do-seu-espaco-de-trabalho'

export async function POST(req: Request) {
  // 🔴 Esta rota é PÚBLICA: qualquer um na internet pode chamá-la. Confira um segredo antes
  // de qualquer coisa, e guarde-o numa variável de ambiente do painel — nunca no arquivo.
  if (req.headers.get('x-meu-segredo') !== MEU_SEGREDO) {
    return new Response('nao autorizado', { status: 401 })
  }

  const corpo = await req.json()
  const db = clienteSemIsolamento()

  // ⚠️ `clienteSemIsolamento()` IGNORA o isolamento entre espaços de trabalho. Aqui o filtro
  // é responsabilidade sua: sem o `workspace_id`, o dado de um cliente seu vai parar noutro.
  await db.from('meus_contratos').insert({ workspace_id: MEU_WORKSPACE, titulo: corpo.titulo })

  return Response.json({ ok: true })
}
```

Se quem chama é o navegador de alguém que já está logado no CRM, **não use isso**: use
`usarSessao()` e `clienteDaSessao()` de `@awave/custom`, e o isolamento é automático.

## O que vale saber

- **Erro no seu código vira 500 com a mensagem**, e o servidor continua de pé. Endereço que
  não existe vira 404.
- **Método não exportado vira 405.** Se você só exportou `GET`, um `POST` recebe 405.
- **Estas rotas param quando a licença do CRM está bloqueada** (reembolso confirmado ou
  instalação recente sem validar), com **403** e `{"error":{"code":"licenca_bloqueada"}}` —
  igual às rotas `/api/v1` do produto. Não é bug do seu código.
