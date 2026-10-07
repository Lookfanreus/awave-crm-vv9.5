# `custom/` — a sua zona

Esta pasta é **sua**. Tudo que estiver aqui dentro é **preservado** quando o CRM atualiza:
a atualização substitui os arquivos do produto, mas nunca toca nesta pasta.

O resto da árvore é o contrário: qualquer arquivo do produto que você editar **será
sobrescrito** na próxima atualização, sem aviso. Se você precisa mudar algo, o caminho é
colocar a mudança aqui.

## O que dá pra fazer aqui

| Pasta | O que você põe | O que acontece | Detalhes |
|---|---|---|---|
| `custom/migrations/` | `.sql` numerado de 9000 pra cima | tabelas suas, criadas no boot | abaixo |
| `custom/paginas/` | uma pasta com `pagina.tsx` | uma tela sua em `/x/<nome>` | [`paginas/LEIA-ME.md`](paginas/LEIA-ME.md) |
| `custom/slots/` | um arquivo por âncora | um bloco seu dentro de uma tela do CRM | [`slots/LEIA-ME.md`](slots/LEIA-ME.md) |
| `custom/api/` | um arquivo por endereço | um endereço em `/api/custom/<nome>` | [`api/LEIA-ME.md`](api/LEIA-ME.md) |
| `custom/tarefas/` | um arquivo por tarefa | código seu rodando de tempos em tempos | [`tarefas/LEIA-ME.md`](tarefas/LEIA-ME.md) |
| `custom/eventos/` | um arquivo com o nome do evento | código seu reagindo ao que acontece | [`eventos/LEIA-ME.md`](eventos/LEIA-ME.md) |
| `custom/menu.ts` | uma lista | suas telas no menu lateral | comentários no arquivo |

**Onde há alguém logado e onde não há.** Em tela (`paginas/`) e em bloco (`slots/`) existe
sessão: use `clienteDaSessao()` e o isolamento entre espaços de trabalho é automático. Em
`api/`, `tarefas/` e `eventos/` **não há ninguém logado** — lá o caminho é
`clienteSemIsolamento()`, e o filtro por espaço de trabalho passa a ser seu (ver o aviso no
fim deste arquivo).

**Três regras valem para as seis últimas:**

1. **Importe só de `@awave/custom`** (a lista completa está mais abaixo). O que está em
   `src/` é interno do produto e muda entre versões — o que você importar de lá funciona hoje
   e quebra depois de uma atualização, sem aviso.
2. **Erro ao RODAR fica contido.** Se a sua tela quebra durante o uso, ela mostra o erro e só
   ela: o resto do CRM, o boot e a atualização em 1 clique seguem funcionando.
   - ⚠️ **Erro de SINTAXE é diferente**, assim como importar um pacote que não existe: os dois
     impedem o servidor de **reconstruir**. O CRM continua no ar na versão que já estava — mas
     a próxima atualização fica parada em "aguardando" até você corrigir. A mensagem sai no log
     de build do painel (EasyPanel → Implantações), com arquivo e linha.
3. **O seu código não é conferido pelo compilador do produto** — erro de tipo aparece só
   quando a tela roda. **Confira antes de subir** e você não cai em nenhum dos dois casos
   acima; este comando lê só esta pasta:

   ```
   pnpm exec tsc -p custom --noEmit
   ```

   Seu editor também entende a pasta sozinho (há um `custom/tsconfig.json` aqui).

## Bibliotecas do npm

Crie um `package.json` **dentro desta pasta**, com as dependências que você usa:

```json
{ "dependencies": { "alguma-lib": "^1.0.0" } }
```

Elas são instaladas isoladamente quando o servidor reconstrói, e **não** mexem no
`package.json` do produto — que continua sendo arquivo que você não deve editar.

## O que você pode importar

```ts
// dado e sessão — em página, bloco e endereço
import { usarSessao, clienteDaSessao } from '@awave/custom'

// componentes visuais, pra sua tela ter a cara do CRM
import { CabecalhoPagina, KpiCard, ListCard, EstadoVazio, Pill, Esqueleto } from '@awave/custom/ui'

// SÓ onde não há ninguém logado (custom/api/, custom/tarefas/, custom/eventos/)
// — ver o aviso no fim deste arquivo
import { clienteSemIsolamento } from '@awave/custom/servidor'
```

Ícones aceitos em `custom/menu.ts`: `Wallet`, `FileText`, `Package`, `Truck`, `Receipt`,
`Users`, `Bot`, `Boxes`, `ClipboardList`, `Landmark`, `Sparkles`, `Puzzle`. Nome fora da
lista vira o ícone padrão, sem erro.

### Os limites do `custom/menu.ts` — e o que acontece quando você passa deles

Um item fora destes limites **é recusado sem erro na tela e sem linha no log**. Se um item seu
não apareceu no menu, **confira esta tabela antes de procurar em qualquer outro lugar**.

| Regra | Passando dela |
|---|---|
| No máximo **10 itens** | do 11º **válido** em diante, o resto **não aparece** (entradas recusadas não gastam a cota) |
| `titulo` até **40 caracteres**, e não vazio | o item **some inteiro** — não é cortado |
| `caminho` até **200 caracteres**, e não vazio | o item **some inteiro** |
| `caminho` na forma `/x/nome` (veja abaixo) | o item **some inteiro** |
| `grupo` até **24 caracteres** | vira **"Personalizado"** (o item continua aparecendo) |
| `icone` da lista acima | vira o **ícone padrão** (o item continua aparecendo) |

As duas últimas linhas **degradam**; as quatro primeiras fazem o item **sumir**. Campo ausente
ou em branco conta como inválido — não é só sobre passar do tamanho.

**A forma do `caminho`** é a mesma que a pasta em `custom/paginas/` aceita:

- começa com `/x/`;
- só **letras minúsculas, números e hífen**, e o hífen nunca na ponta;
- no máximo **3 níveis** depois do `/x/`.

Estes todos são recusados, e é o tropeço mais comum: `/x/Financeiro` (maiúscula),
`/x/relatórios` (acento), `/x/meu_modulo` (sublinhado), `/x/meu modulo` (espaço),
`/x/financeiro-` (hífen na ponta), `/x/a/b/c/d` (fundo demais). O que funciona é
`/x/financeiro`, `/x/nota-fiscal`, `/x/estoque/entradas`.

## `custom/migrations/` — tabelas suas no mesmo banco

Coloque aqui arquivos `.sql` para criar tabelas ou colunas próprias. Eles rodam junto com
as atualizações oficiais do banco, no boot, automaticamente.

**A numeração é obrigatória e começa em 9000.** Nome no formato `9001_o_que_faz.sql`:

```
custom/migrations/9001_tabela_de_contratos.sql
custom/migrations/9002_campo_no_contrato.sql
```

As migrations oficiais do CRM ficam **abaixo** de 9000 e as suas de 9000 pra cima. Os dois
intervalos não se encostam, então uma atualização do produto nunca colide com um número
que você já usou. Um arquivo fora da faixa **impede o boot** com uma mensagem dizendo o
nome do arquivo — de propósito: é melhor não subir do que aplicar na ordem errada.

## ⚠️ Se a sua tabela guarda dado de cliente, ela PRECISA de RLS

O Awave CRM é **multi-inquilino**: um mesmo servidor hospeda vários espaços de trabalho, e
o isolamento entre eles é feito no banco, não no código. Uma tabela criada sem essas três
linhas fica **legível por qualquer espaço de trabalho** — e por qualquer pessoa com a chave
pública do seu Supabase.

Modelo seguro para copiar:

```sql
create table if not exists public.meus_contratos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  titulo text not null,
  criado_em timestamptz not null default now()
);

-- As duas linhas que fazem o isolamento de LEITURA. Não pule.
alter table public.meus_contratos enable row level security;

create policy meus_contratos_sel on public.meus_contratos
  for select to authenticated using (public.e_membro(workspace_id));
```

Sem `workspace_id`, sem `enable row level security` e sem a policy, o dado de um cliente
seu aparece para outro. Não há aviso quando isso acontece.

🔴 **Não crie policy de escrita para `authenticated`** (nada de `for all` nem `for insert` /
`for update` / `for delete` na sua tabela). A partir da tela de Conversas, o CRM traz cliente
Supabase pro NAVEGADOR (Realtime) — e o Postgres não tem como distinguir "o servidor agindo em
nome do usuário" de "o usuário agindo pelo console do navegador direto": é o mesmo JWT. Uma
policy `for all` autoriza as duas, e a segunda pula sua rota, sua validação e qualquer regra
que você tenha escrito em código. Escreva pelas suas rotas em `custom/api/`, que rodam no
servidor e usam `clienteSemIsolamento()` — service-role, que não passa pela RLS e por isso
nunca precisa de policy de escrita.

## ⚠️ `clienteSemIsolamento()` — leia antes de usar

Ele devolve um acesso ao banco que **ignora o isolamento entre espaços de trabalho**. Existe
pelos três lugares onde não há ninguém logado: um endereço em `custom/api/` chamado por um
sistema de fora, e as `custom/tarefas/` e `custom/eventos/`, que rodam no relógio do servidor.
Sem sessão, o banco não tem como saber de quem é o dado.

Sob ele, o filtro é responsabilidade sua:

```ts
const db = clienteSemIsolamento()

// ERRADO — devolve os contratos de TODOS os clientes hospedados neste servidor
await db.from('meus_contratos').select()

// CERTO
await db.from('meus_contratos').select().eq('workspace_id', MEU_WORKSPACE)
```

Em página e em bloco existe sessão, então use `clienteDaSessao()`: lá o isolamento é
automático e você não precisa lembrar de nada. Por isso `clienteSemIsolamento` **nem é
exportado** por `@awave/custom` — só por `@awave/custom/servidor`.

## O que NÃO fazer aqui

- **Não apague esta pasta.** Sem ela, o CRM ainda sobe, mas você perde a zona protegida.
- **Não coloque segredo em arquivo.** Chaves e senhas ficam nas variáveis de ambiente do
  painel, nunca no repositório.
- **Não use números abaixo de 9000** em `custom/migrations`.
- **Não aponte um item do menu para fora de `/x/`.** Ele é ignorado: o menu do CRM não se
  reorganiza a partir daqui.
