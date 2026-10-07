# Awave CRM

CRM completo que roda **no seu servidor**, contra o **seu** banco de dados. Contatos,
empresas, negócios num quadro de arrastar e soltar, atividades e agenda, campos criados por
você, automações, relatórios e uma **caixa de entrada de WhatsApp e de mensagens diretas do
Instagram** — com vários espaços de trabalho dentro da mesma instalação.

O produto inteiro funciona **offline e para sempre**, e **nenhuma funcionalidade é vendida à
parte**: não existe tela, campo ou relatório que a licença destranque. A licença habilita só a
atualização em um clique — e mesmo sem ela existe o caminho manual, com o CRM inteiro no ar.

**A caixa de entrada e o assistente são opcionais e nascem desligados** — e são a parte que
não roda offline. Cada um depende de uma conta sua fora do CRM: um servidor de mensagens ou
a Meta para os canais, e uma conta de inteligência artificial para o **assistente**
automático, que responde sozinho enquanto a sua equipe não pode. **Quem não ligar nenhum
não muda nada:** o CRM segue exatamente como está. O [`docs/DEPLOY.md`](docs/DEPLOY.md) traz o
custo de cada um **antes** do passo a passo.

O acesso ao CRM só para em **dois casos**, e os dois são sobre a licença em si, nunca sobre o
que o produto faz:

- **uma compra reembolsada dentro do prazo de garantia**;
- **uma instalação recente que passou alguns dias sem conseguir confirmar a licença** — por
  falta de internet no servidor, por exemplo. Esse se **resolve sozinho** assim que a
  confirmação chega, e o CRM tenta sozinho o tempo todo: basta não desligar o relógio interno,
  que já vem ligado (o [`docs/DEPLOY.md`](docs/DEPLOY.md) explica em "não crie esta variável").

---

## Instalar

O guia é o **[`docs/DEPLOY.md`](docs/DEPLOY.md)**, escrito para quem nunca usou Docker: vai
do `.zip` que você recebeu até a conta do dono criada.

Em uma linha: o CRM sobe como **um container**, buildado pelo `Dockerfile` que já vem na sua
cópia, contra um projeto **Supabase** seu, e recebe **três variáveis de ambiente** no painel
do servidor. Nenhum segredo mora dentro da imagem — as chaves ficam nas variáveis e podem ser
trocadas a qualquer momento.

Se o app não subir, o próprio log diz o que falta, e a seção "O app não subiu" do guia traz a
tabela de mensagem por mensagem.

## Customizar sem perder o trabalho

A atualização **substitui os arquivos do produto**. Por isso existe uma zona que é sua:

- **[`custom/`](custom/LEIA-ME.md)** — tudo aqui dentro é preservado em toda atualização.
  São sete pontos de extensão: tabelas suas (`custom/migrations/`, arquivos `.sql` numerados
  de `9000` para cima, aplicados no boot), telas (`custom/paginas/`), blocos dentro de telas
  do produto (`custom/slots/`), endereços de API (`custom/api/`), código rodando de tempos em
  tempos (`custom/tarefas/`), código reagindo ao que acontece (`custom/eventos/`) e os itens
  do menu lateral (`custom/menu.ts`). Leia
  [`custom/LEIA-ME.md`](custom/LEIA-ME.md) antes da primeira linha — em especial a parte de
  `row level security`, que é o que isola a **leitura** entre espaços de trabalho: uma tabela
  sua sem ela mostra o dado de um cliente para outro, sem nenhum aviso. Já na **escrita** o
  banco não isola nada — em `custom/api/`, `custom/tarefas/` e `custom/eventos/` não há
  ninguém logado, o acesso ao banco é pela chave secreta, e o filtro por espaço de trabalho
  passa a ser **seu, no código**. O `LEIA-ME` mostra o certo e o errado lado a lado.
- **[`AGENTS.md`](AGENTS.md)** — as mesmas regras escritas para um agente de código (Claude
  Code, Cursor, Codex). Se você desenvolve com IA, é esse arquivo que a mantém dentro de
  `custom/` em vez de editar o produto.

Editar arquivos fora de `custom/` funciona, mas a edição é sobrescrita na próxima
atualização — sobra uma cópia num branch de backup, e a tela de atualização avisa antes de
qualquer coisa.

Nome, logo e cores **não são código**: mudam em **Configurações → Servidor → Marca**.

## Atualizar

Em **Configurações → Servidor → Atualizações**, dentro do próprio CRM. Com licença ativa
é um botão: o CRM baixa a versão nova, envia para o **seu** repositório e o servidor
reconstrói sozinho.

Duas coisas que a tela repete e que valem antes do primeiro clique: "enviado" ainda não é
"atualizado" (o servidor leva alguns minutos reconstruindo, e a versão no rodapé só muda no
fim), e "desfazer" volta o **código**, não o banco.

Sem licença, o caminho manual continua valendo e está no `docs/DEPLOY.md`. O que muda em cada
versão está no [`CHANGELOG.md`](CHANGELOG.md).

## Ajuda

1. **[`docs/DEPLOY.md`](docs/DEPLOY.md)** — instalação, atualização, backup e a lista de erros
   de boot com a solução de cada um. Comece sempre por aqui.
2. A **página de diagnóstico** do próprio CRM, para quando ele sobe mas alguma variável está
   errada. O guia explica quando ela aparece — e quando ela não ajuda em nada.
3. **A área de membros onde você comprou** (<https://elitedaia.com.br>). Tenha em mãos a
   **versão**, que aparece no rodapé de Configurações: é a primeira coisa que o suporte
   pergunta.
