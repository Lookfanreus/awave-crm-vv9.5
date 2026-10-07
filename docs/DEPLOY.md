# Instalar o Awave CRM (EasyPanel + Supabase)

Este guia é pra quem **nunca usou Docker** e não quer aprender. É o caminho **seco** da
instalação: os passos, os valores e as decisões, sem prints. Ele vem dentro do produto e
funciona sem internet, sem licença e sem conta em lugar nenhum — é por isso que ele existe,
e é por isso que ele **basta sozinho**.

> 📘 **A versão ilustrada, com prints de cada tela, está na área de membros onde você
> comprou:** <https://elitedaia.com.br/guia/crm>
>
> Lá a mesma instalação aparece com as telas do Supabase e do EasyPanel fotografadas, mais
> os assuntos que não cabem aqui: funis e etapas, campos próprios, importar planilha,
> colocar a sua marca, convidar a equipe. **É preciso estar logado** com a conta da compra.
>
> Se você não alcança essa página agora — sem internet, sem a conta em mãos, ou porque o CRM
> ainda nem subiu —, siga por este arquivo. Ele te leva até o fim.

Do zero ao CRM no ar são **três valores copiados e colados**. Se algo der errado, o próprio
CRM escreve no log o que falta (§8). O CRM roda como **1 container** buildado a partir do
`Dockerfile` que já vem na sua cópia, e o banco é um **Supabase** seu (de graça pra começar).
**Nenhum segredo vai dentro da imagem** — as chaves ficam nas variáveis do EasyPanel.

> **Infra: uma VPS com 2 GB de RAM e 2 vCPU.** O pico da instalação inteira é o **build da
> imagem**, e ele foi medido: ~1 GB numa máquina de 2 núcleos, até ~1,8 GB numa de muitos
> núcleos. **Uma VPS de 1 GB não serve** — o build morre por falta de memória (`Killed` no
> log). E **não precisa de 4 GB**: se você viu esse número no guia do Awave Agents (o produto
> de IA), aquele é outro build. Depois de no ar, o dia a dia é leve.

**Índice**

0. [Recebi um `.zip` — comece aqui](#0-recebi-um-zip--comece-aqui)
1. [Criar o Supabase e pegar os três valores](#1-criar-o-supabase-e-pegar-os-três-valores)
2. [As três variáveis (e por que não existe variável de build)](#2-as-três-variáveis-e-por-que-não-existe-variável-de-build)
3. [Criar o app no EasyPanel](#3-criar-o-app-no-easypanel)
4. [O primeiro boot: o que esperar no log](#4-o-primeiro-boot-o-que-esperar-no-log)
5. [O primeiro acesso: criar a conta do dono](#5-o-primeiro-acesso-criar-a-conta-do-dono)
6. [Atualizar pra uma versão nova](#6-atualizar-pra-uma-versão-nova)
   - [6.1 Atualizar em um clique](#61-atualizar-em-um-clique-com-licença-ativa)
   - [6.2 Licença (opcional)](#62-licença-opcional)
   - [6.3 Assistente automático (opcional)](#63-assistente-automático-opcional)
   - [6.4 WhatsApp por código de pareamento (opcional)](#64-whatsapp-por-código-de-pareamento-opcional)
   - [6.5 WhatsApp oficial da Meta (opcional)](#65-whatsapp-oficial-da-meta-opcional)
   - [6.6 Instagram — mensagens diretas (opcional)](#66-instagram--mensagens-diretas-opcional)
   - [6.7 Se o CRM ficar lento](#67-se-o-crm-ficar-lento-não-aumente-o-número-de-cópias-do-aplicativo)
7. [Backup](#7-backup)
8. [O app não subiu](#8-o-app-não-subiu)
   - [8.3 "Este banco já tem tabelas do CRM"](#83-este-banco-já-tem-tabelas-do-crm)

---

## 0. Recebi um `.zip` — comece aqui

> 📘 **Os §0 a §4 com prints de cada tela do Supabase e do EasyPanel:**
> <https://elitedaia.com.br/guia/crm/comece-aqui/colocar-no-ar>

O EasyPanel builda a partir de um **repositório Git**, então o `.zip` precisa virar um repo
seu. É uma vez só.

1. **Descompacte o `.zip`.** Na raiz já estão o `Dockerfile`, a pasta `supabase/migrations`
   e o `src/` — não há pasta extra envolvendo tudo.
2. **Crie um repositório PRIVADO seu** no GitHub (ou GitLab). Vazio, sem README.
3. **Suba o conteúdo descompactado** pra ele:

   ```bash
   git init
   git add .
   git commit -m "Awave CRM — minha copia"
   git branch -M main
   git remote add origin <endereco-do-seu-repo-privado>
   git push -u origin main
   ```

   > **Nunca usou Git pela linha de comando?** Dá pra fazer tudo pelo **GitHub Desktop**:
   > *File → Add local repository* → aponte pra pasta descompactada → *Publish repository*
   > → marque **Keep this code private**.

4. **No EasyPanel, aponte o app pra ESSE repo** (§3). Daqui pra frente, "o repositório" =
   o seu repo privado.

---

## 1. Criar o Supabase e pegar os três valores

Entre em **[supabase.com](https://supabase.com)** → **New project**. Dê um nome, escolha a
região mais perto dos seus usuários (no Brasil: `South America (São Paulo)`) e **crie uma
senha de banco**. Leva uns 2 minutos.

> ⚠️ **Guarde essa senha.** Ela é a **senha do BANCO**, e **não é** a senha da sua conta do
> Supabase. Você precisa dela no passo seguinte e o Supabase não a mostra de novo. Se perder,
> gere outra em **Database → Settings → Database password → Reset password** — isso derruba
> as conexões abertas, então atualize a `SUPABASE_DB_URL` (§2.1) e faça um **Deploy**.

### 1.1 `SUPABASE_DB_URL` — o endereço do banco

Botão **Connect**, no topo da tela do projeto → aba **Direct / Connection string** → em
**Connection Method**, escolha **Session pooler** → copiar. (Em painéis mais antigos:
**Settings → Database → Connection string → Session pooler**.) Você copia algo assim:

```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

⚠️ **Troque o `[YOUR-PASSWORD]` (colchetes inclusive) pela senha do BANCO.** É o erro nº 1 de
quem instala — e é a senha do **banco**, não a da sua conta Supabase.

⚠️ **Tem que ser a aba "Session pooler".** As outras duas não servem:
- **Direct connection** (`db.<algo>.supabase.co`) só funciona por IPv6 e **não resolve na
  maioria das VPS** — o CRM detecta e recusa com uma mensagem explicando.
- **Transaction pooler** (porta `6543`) não suporta o mecanismo que aplica as atualizações
  do banco. Se você colar essa, o CRM troca pra `5432` sozinho e avisa no log — mas prefira
  já colar a certa.

As duas chaves seguintes estão na mesma tela: **Settings → API Keys**.

### 1.2 `SUPABASE_ANON_KEY` — a chave pública

Aparece como **`anon` / `public`** (projetos antigos) ou como **Publishable key**, começando
com `sb_publishable_` (novos). Qualquer uma das duas serve — é a que pode ser vista pelo
navegador.

### 1.3 `SUPABASE_SERVICE_ROLE_KEY` — a chave secreta

Mesma tela. Aparece como **`service_role` / `secret`** (antigos) ou como **Secret key**,
começando com `sb_secret_` (novos). Talvez precise clicar em **Reveal** pra ver.

> 🔒 A secreta dá acesso total ao banco. Ela **só** vai pro EasyPanel — nunca a cole num
> chat, num print ou num repositório público.

**Você NÃO precisa rodar nenhum SQL.** O CRM cria as tabelas sozinho no primeiro boot. E se
você colar as duas chaves trocadas, ou a mesma nos dois campos, o CRM percebe no boot e te
diz exatamente isso (§8).

---

## 2. As três variáveis (e por que não existe variável de build)

### 2.1 As três variáveis de runtime

No EasyPanel, aba **Environment** do app:

| Variável | Obrigatória | O que é |
|---|---|---|
| `SUPABASE_DB_URL` | ✅ | A connection string do **Session pooler** (§1.1), **já com a senha do banco no lugar do `[YOUR-PASSWORD]`**. É por ela que o CRM cria e atualiza as tabelas sozinho. |
| `SUPABASE_ANON_KEY` | ✅ | A chave **pública** (§1.2). |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | A chave **secreta** (§1.3). |

Essas três variáveis também estão no arquivo **`.env.example`**, na raiz do seu
repositório — dá pra copiar de lá, preencher e colar. (O CRM não lê esse arquivo: ele é
só a lista pronta pra colar no painel.)

Formato no EasyPanel (uma por linha, sem aspas):

```
SUPABASE_DB_URL=postgresql://postgres.abcdefghijklmnop:minhasenha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

> ⚠️ **Cuidado com espaço sobrando ao colar.** O CRM apara os espaços em volta de toda chave
> que lê, mas um espaço perdido na caixa de texto do EasyPanel já quebrou o primeiro acesso
> de alguém: o log imprimia uma chave e o cadastro esperava outra.

### 2.2 ⚠️ NÃO existe variável de build neste produto

Se você já instalou o **Awave Agents** (o produto de IA), lembra que lá era preciso repetir
umas variáveis na aba de **build** ("Build Arguments" / `NEXT_PUBLIC_*`). **Aqui não.** Não
procure essa tela, não copie nada pra ela: **o campo de build arguments fica vazio.**

O CRM lê a configuração **em tempo de execução**, de propósito. É o que permite que a mesma
imagem funcione pra qualquer comprador e que você troque uma chave sem rebuildar nada — e é
o que garante que **as credenciais de quem gerou a sua cópia nunca fiquem gravadas dentro da
imagem**.

> **Você não precisa configurar o endereço do projeto Supabase (`SUPABASE_URL`).** O CRM o
> descobre sozinho a partir da connection string. (Só quem usa **Supabase self-host** precisa
> informá-lo à mão, como uma quarta variável — nesse caso o CRM avisa no boot.)

### 2.3 `HEARTBEAT_ENABLED` — não crie esta variável

| Variável | Obrigatória | O que é |
|---|---|---|
| `HEARTBEAT_ENABLED` | ❌ — **já vem ligada** | Liga o **relógio interno** do CRM. Não adicione esta variável: sem ela o relógio sobe ligado, que é o certo. Ela só existe para o caso raro de alguém precisar desligá-lo (`HEARTBEAT_ENABLED=0`). |

O relógio interno é o que faz o CRM trabalhar **sozinho**, sem ninguém com a tela aberta:
confirmar a sua licença de tempos em tempos, rodar as automações que você criar e entregar os
avisos para a integração de IA, se você plugar uma.

> ⚠️ **Se você desligar** (`HEARTBEAT_ENABLED=0`): as automações param de rodar e **a sua
> licença deixa de ser confirmada sozinha**. Numa instalação recente **que já tem uma chave
> colada**, passados alguns dias sem conseguir confirmar, o CRM para na frente de todo mundo
> pedindo confirmação, e só o **dono do servidor** destrava (em
> **Configurações → Servidor → Licença**, botão
> **Verificar agora**). Isso vale mesmo se o servidor ficar dias sem internet: com o relógio
> ligado ele tenta sozinho e destrava quando a conexão voltar; desligado, ninguém tenta.

### 2.4 `HEARTBEAT_INTERVAL_MS` — de quanto em quanto tempo o relógio acorda

| Variável | Obrigatória | O que é |
|---|---|---|
| `HEARTBEAT_INTERVAL_MS` | ❌ — **padrão 30000** (30 s) | De quanto em quanto tempo o relógio interno acorda, em milissegundos. Não precisa criar. Mínimo aceito: `5000`. Teto recomendado: `1800000` (30 minutos), pelo motivo logo abaixo. |

**É a variável que mais mexe no consumo do seu banco.** Num CRM parado, o relógio responde por
volta de **84% de todas as consultas** — ele acorda a cada 30 segundos mesmo quando não há nada
para fazer. Um comprador mediu, depois de estourar a cota gratuita do Supabase: passando
para `300000` (5 minutos), o consumo caiu de ~61.700 para ~15.300 consultas por dia, **sem mexer
em uma linha de código**.

> **O preço, para você decidir:** as automações, o assistente automático e a entrega de avisos
> para a integração de IA passam a responder com até esse atraso. Cinco minutos costuma ser
> imperceptível num CRM de vendas; se você usa o assistente respondendo no WhatsApp, prefira
> deixar no padrão ou algo como `60000`.

> **Teto: `1800000` (30 minutos).** Se você usa os ganchos de evento da pasta `custom/eventos`,
> o CRM avisa o banco a cada batida que os ganchos estão ligados, e o banco só guarda eventos
> enquanto esse aviso tem menos de 1 hora. Acima de `3600000` (1 hora) os eventos que acontecem
> entre uma batida e outra são descartados, sem erro e sem registro: o gancho simplesmente não
> roda. Entre 30 minutos e 1 hora, uma batida que atrase ou falhe já custa eventos. O CRM avisa
> no log, na hora em que sobe, quando o valor passa do teto.

---

---

## 3. Criar o app no EasyPanel

> **Antes: dê ao EasyPanel acesso ao seu repositório.** Ele é privado. **No EasyPanel** (não
> no CRM), vá em **Configurações → Servidor → Github** e cole um *personal access token* do
> GitHub com o escopo **`repo`** — a própria tela explica. Uma vez por servidor.
>
> ⚠️ **Esse token não é o mesmo da atualização em um clique (§6.1).** Este é do EasyPanel, é
> *clássico*, e o escopo `repo` alcança **todos** os repositórios da sua conta. O da §6.1 é
> criado dentro do CRM, é *fine-grained* e você o limita a **um**. Não reaproveite um no outro.

1. **Create → App**, dê um nome (ex.: `crm`).
2. **Source:** *GitHub* → **Proprietário** (seu usuário), **Repositório** (o do §0), **Ramo**
   `main`, **Caminho de Build** `/`.
3. ⚠️ **Build: o método TEM que ser `Dockerfile`.** Na etapa **Construção / Build**,
   selecione **Dockerfile** e deixe o campo do arquivo vazio (ele usa o da raiz). **Nenhum
   outro serve** — nem Buildpacks, nem Nixpacks, nem Railpack.

   > Isto **não é preferência de gosto**: em qualquer builder que não seja o Dockerfile o
   > EasyPanel **ignora completamente** o `Dockerfile` e o `.dockerignore` da sua cópia. É
   > justamente neles que mora a proteção que impede credenciais de serem assadas dentro da
   > imagem — fora do Dockerfile esse bug volta na hora, e volta em silêncio.

4. **Environment:** cole as três variáveis do §2.1. Salve.
5. **Domains:** aponte o seu domínio (ou o de teste que o EasyPanel já criou) pra porta
   **80**, que é o padrão — normalmente não há nada a mudar. O container escuta na 80 sem
   rodar como root.
6. **Réplicas = 1.** Sem autoscaling, sem réplica extra.
7. Clique em **Deploy**. O primeiro build demora alguns minutos; os próximos são mais rápidos.
8. 🔴 **Copie o Gatilho de Implantação.** Ainda no EasyPanel, abra o serviço do CRM → aba
   **Implantações** (ou *Deployments*) → seção **Gatilho de Implantação**, e copie a **URL**
   (`http://…/api/deploy/…`). Guarde: no §6.1 você a cola no CRM, uma vez só. É ela que faz a
   atualização em um clique **terminar** — sem ela o CRM envia a versão nova pro seu
   repositório e para, porque quem reconstrói é o EasyPanel e ninguém o avisou.

   > ⚠️ Essa URL é **secreta** — quem a tiver manda o seu servidor reconstruir. O CRM a guarda
   > criptografada no seu banco e nunca a mostra inteira de volta.

---

## 4. O primeiro boot: o que esperar no log

Abra o app no EasyPanel → aba **Logs**. Num boot saudável você vê, nesta ordem:

```
[preflight] modo: normal

========================================
  CHAVE DO PRIMEIRO ACESSO: 3F9A21C7B04D
  Use-a uma única vez, ao criar a conta do dono.
========================================

[migrate] Aplicando 0001_vault.sql…
[migrate] Aplicando 0002_crm_nucleo.sql…
...
[migrate] OK — N migration(s) aplicada(s).
▲ Next.js  ✓ Ready
```

- **`[preflight] modo: normal`** = a configuração passou. Se aparecer `PROBLEMA` ou
  `modo: diagnostico`, vá pro §8.
- **A CHAVE DO PRIMEIRO ACESSO — copie-a agora.** É ela que libera a criação da conta do dono
  (§5), e ela **só aparece no log**, nunca numa página: se aparecesse na tela, qualquer um que
  descobrisse o seu domínio poderia se tornar o dono do seu CRM. Ela não é perecível — é
  **sempre a mesma** enquanto a sua `SUPABASE_SERVICE_ROLE_KEY` for a mesma, e reaparece a
  cada boot. Trocou a chave secreta no Supabase? A do primeiro acesso muda junto.
- **`▲ Next.js  ✓ Ready`** é a linha de chegada. Se o log parar antes dela, o §8 resolve.
- **O `N` do `OK` é literal:** ele é a quantidade de arquivos que a SUA versão traz, e
  **cresce a cada versão** nova do CRM — qualquer número ali é normal. O que importa é a
  palavra `OK`. Nos boots seguintes as linhas de `[migrate] Aplicando …` não aparecem:
  você lê `[migrate] Nenhuma migration pendente.`, e isso também é o normal.

---

## 5. O primeiro acesso: criar a conta do dono

1. Abra o seu domínio. Numa instalação nova o CRM te leva direto pra tela de **cadastro** (não
   pro login — não haveria conta nenhuma pra usar), com o título **"Este é o seu Awave CRM.
   Crie a conta do dono."**
2. Preencha **e-mail** e **senha** (mínimo 6 caracteres), o **nome do workspace** e a **chave
   do primeiro acesso** (a do §4 — pode colar em minúsculas ou com espaço sobrando).
3. **Criar conta.** Você já entra logado, com um funil de vendas pronto pra usar.

Errou a chave? A tela diz isso e você tenta de novo — **errar não queima nada**. Depois que o
dono existe, a **porta se fecha sozinha**: novos cadastros são recusados e o campo da chave
some da tela (ela vira inútil, mesmo que alguém a leia no log).

> **Preciso de uma segunda conta na equipe.** Vá em **Configurações → Pessoas**, escolha o
> tipo de acesso e clique em **Gerar link**. Mande o link para a pessoa por onde preferir —
> ela abre, cria a senha dela e já entra no seu espaço de trabalho. **Trate o link como uma
> senha:** quem tiver ele entra. Vale 7 dias, some depois de usado, e dá para cancelar na
> mesma tela. Nada é enviado por e-mail pelo CRM — ele roda no **seu** servidor e não assume
> que você tem um serviço de e-mail configurado.
>
> **Não** reabra o cadastro para isso: enquanto ele estiver aberto, qualquer um que descubra o
> endereço do seu CRM pode criar uma conta.

> 📘 **Esta seção com prints, e a diferença entre "dono do servidor" e "dono de um espaço de
> trabalho":** <https://elitedaia.com.br/guia/crm/comece-aqui/conta-do-dono>
>
> **Daqui em diante o guia web assume**, com os assuntos que este arquivo não cobre — funis e
> etapas, campos próprios, importar planilha, marca, equipe:
> <https://elitedaia.com.br/guia/crm>

---

## 6. Atualizar pra uma versão nova

**O caminho manual funciona sempre** — sem licença, sem token, sem o CRM precisar falar com
ninguém. Quando sair uma versão nova, você recebe um `.zip` novo:

1. **Substitua os arquivos** da pasta do seu repo pelos do `.zip` novo.
2. `git add . && git commit -m "atualiza para a versao X" && git push`
3. No EasyPanel: **Deploy**.

> **Este é o caminho oficial e ele não vai desaparecer.** Quem não tem licença, ou está com a
> janela de atualizações vencida, atualiza por aqui, com o produto inteiro funcionando —
> nenhuma tela, nenhum campo e nenhum relatório é vendido à parte.

Não há nada pra reconfigurar: as três variáveis continuam onde estão e os seus dados estão no
seu Supabase, intactos. **As atualizações do banco são automáticas** — no boot o CRM aplica
sozinho só o que faltava, **antes** do app subir; se alguma falhar, o container novo **não
sobe** e o EasyPanel mantém a versão anterior no ar.

A **CHAVE DO PRIMEIRO ACESSO** continua aparecendo no log a cada boot. É normal e inofensivo:
depois que o dono existe, ela não abre mais nada.

**Qual versão eu tenho?** No rodapé de **Configurações**. É a primeira coisa que o suporte
pergunta.

### 6.1 Atualizar em um clique (com licença ativa)

Em **Configurações → Servidor → Atualizações** há um botão que faz os três passos acima
sozinho. Ele precisa de três coisas, uma vez só: o endereço do seu repositório, um token do
GitHub (*fine-grained*, limitado a esse repositório, com **Contents: Read and write**) e o
**Gatilho de Implantação** do §3 passo 8. A própria tela traz o passo a passo, com os links
que já abrem a página certa.

- **"Enviado" não é "atualizado".** Depois do envio o EasyPanel ainda leva alguns minutos
  reconstruindo, e a versão no rodapé só muda no fim. Pode fechar a página.
- **Sem o Gatilho colado, a tela te diz isso** em vez de fingir que está pronto: ela manda
  abrir o EasyPanel e clicar em **Deploy** uma vez. É também a resposta pra "atualizei e a
  versão não mudou" — o código novo já está no seu repositório desde a primeira tentativa.
- **Se você editou arquivos do CRM**, a tela avisa quantos e salva uma cópia num branch de
  backup (`awave-backup/pre-vX.Y.Z`) **antes** de qualquer alteração. A pasta `custom/` é sua
  e nunca é tocada.
- **"Desfazer" volta o código, não o banco.** Se a versão nova criou ou removeu campos, eles
  continuam como estão. Use só se algo quebrou, e chame o suporte em seguida.

**Quem pode clicar:** só o **dono do servidor**, a conta do primeiro cadastro — o botão
reescreve o seu repositório do GitHub e reconstrói o CRM de **todos** os espaços de trabalho.

> 📘 **O passo a passo ilustrado** — criar o token, colar o Gatilho, e o que a tela diz em
> cada caso: <https://elitedaia.com.br/guia/crm/servidor/atualizar>

> **Precisa transferir a conta de dono?** (o dono saiu da empresa, ou a conta se perdeu).
> Rode no **SQL Editor** do Supabase, trocando o e-mail:
>
> ```sql
> insert into public.settings (key, value)
> select 'dono_deploy_user_id', id::text from auth.users where email = 'novo-dono@empresa.com'
> on conflict (key) do update set value = excluded.value;
> ```
>
> A conta precisa já existir. Se essa linha nunca foi criada (instalações antigas), o CRM usa
> o dono do espaço de trabalho mais antigo — que é o mesmo do primeiro cadastro.

---

## 6.2 Licença (opcional)

**O CRM funciona inteiro sem licença.** Nenhuma tela, nenhum campo e nenhum relatório é
vendido à parte. Se você nunca colar uma chave, nada muda — inclusive as duas situações
abaixo, que só existem para quem tem uma licença, nunca alcançam você.

A licença serve para uma coisa só: habilitar a **atualização em um clique** (§6.1) e dizer até
quando você recebe versões novas. **Se você recebeu uma chave na compra:** vá em
**Configurações → Servidor → Licença**, cole e clique em **Salvar**. A chave não volta a
aparecer depois de salva — a tela mostra só o começo e o fim dela. Guarde a original.

**Nenhum estado normal da licença interrompe o seu trabalho** — nem "sem confirmação
recente", nem **expirada**, nem "em uso em outro servidor". Em todos eles o CRM continua
funcionando, com todos os seus dados, e a própria tela explica cada um.

### As duas situações em que o CRM para e pede confirmação

São exatamente duas, e nas duas o CRM leva todo mundo para uma tela única antes de continuar:

| Situação | O que fazer |
|---|---|
| **Compra reembolsada dentro do prazo de garantia** (7 dias). | Se você não pediu reembolso, fale com o suporte com essa tela aberta. Se o suporte emitir uma chave nova, dá para colá-la ali mesmo. |
| **Instalação recente que passou alguns dias sem conseguir confirmar a licença** (servidor sem internet, por exemplo). | Confira a internet do servidor e clique em **Verificar agora**, na própria tela. Destrava na hora. |

Quem vê a tela e **não é o dono do servidor** só lê que o acesso está temporariamente
indisponível, e que deve avisar o dono — o motivo não aparece para os demais membros, de
propósito. Em qualquer caso há um botão de **sair**, para outra pessoa poder entrar.

> **Seus dados não são apagados em nenhuma dessas situações.** Eles continuam no seu Supabase
> e voltam a aparecer assim que o acesso é liberado.
>
> ⚠️ A segunda situação é a que a variável do §2.3 previne: com o relógio interno ligado (o
> padrão), o CRM tenta confirmar sozinho e destrava assim que a internet voltar.

> 📘 **O que cada estado da licença quer dizer, um por um:**
> <https://elitedaia.com.br/guia/crm/comece-aqui/licenca>

---

## 6.3 Assistente automático (opcional)

O CRM pode responder sozinho as mensagens do WhatsApp enquanto sua equipe não pode. Ele **nasce
desligado**, em todo número, e continua desligado depois de qualquer atualização — ligar é
sempre uma decisão sua.

**Ele exige uma conta paga de inteligência artificial — e ela é a segunda da lista, não a
primeira.** Receber e responder WhatsApp no CRM já depende de uma conta num servidor de
mensagens (§6.4) ou de um número aprovado pela Meta (§6.5), e das duas o assistente não
dispensa nenhuma: ele responde **dentro** de um canal. O resto do CRM — contatos, funil,
atividades, relatórios e importação — não depende de nenhuma dessas contas.

### O que acontece com as conversas quando você liga

> ⚠️ **Ao ligar o assistente num número, o conteúdo das conversas daquele número é enviado para
> a OpenAI (Estados Unidos) para gerar as respostas. Isso inclui o que os seus clientes
> escreverem.**
>
> Enquanto o assistente estiver desligado, nada sai do seu servidor.

Quem responde pelos dados dos seus clientes é você — o CRM roda no seu servidor, o banco é seu e
o número é seu. Leia a frase acima antes de ligar, não depois.

### Como ligar

1. Abra **Agentes de IA** no menu lateral, na seção *Automação e análise*.
2. Na aba **Servidor**, cole a chave da sua conta de inteligência artificial. Ela entra e não
   sai: a tela nunca mostra a chave de volta.
3. Na aba **Agentes**, crie um agente e escreva como ele se apresenta e o que a sua empresa
   faz, em poucas linhas.
4. No mesmo agente, escolha o número em **Onde ele atende** e clique em **Ligar**. **Um de
   cada vez.**

**Só quem instalou o CRM** cola a chave e liga o assistente — é a conta dele que paga. Escrever
como o assistente fala é do dia a dia de cada espaço de trabalho.

### Se você precisar calar o assistente numa conversa só

Abra a conversa na caixa de entrada e escolha alguém em **Assumir**. O assistente para de
responder ali na hora e **não volta sozinho**; para devolvê-la a ele, clique em **Devolver ao
assistente**.

Se o número for do tipo **código de pareamento** (§6.4), há um segundo caminho: responder o
cliente **pelo aplicativo do WhatsApp no celular**. O CRM entende que uma pessoa entrou e o
assistente fica calado naquela conversa por **30 minutos** — passado o prazo, ele volta sozinho.

> ⚠️ **Esse segundo caminho não existe no WhatsApp oficial da Meta.** Naquele tipo de número o
> aparelho sai do ar (§6.5), então não há aplicativo de onde responder e o CRM nunca vê a
> resposta pelo celular. **Use o Assumir**, que funciona nos dois tipos.

Ele também para sozinho quando o **próprio cliente** pede para falar com uma pessoa: aquela
conversa passa a esperar alguém do seu time, e ele não responde mais nela.

Para calar o assistente em todas as conversas de um número de uma vez, abra **Agentes de IA** e
desligue-o na lista **Onde cada número responde**, no fim da aba *Agentes*. Ela mostra **todos**
os números do espaço de trabalho — inclusive os que você nunca ligou a um agente específico, que
são atendidos pelo agente padrão.

### O assistente depende do relógio interno

Ele responde pelo mesmo relógio que entrega os anexos e valida a licença. Se você criou a
variável `HEARTBEAT_ENABLED` com o valor `0`, o assistente **nunca responde**. Ver §2.3: essa
variável não deve ser criada.

---

## 6.4 WhatsApp por código de pareamento (opcional)

É o caminho padrão do produto, e o mais parecido com o que a sua equipe já faz hoje: o número
continua sendo o mesmo, continua funcionando no aplicativo do celular, e as mensagens passam a
aparecer **também** em **Conversas**, dentro do CRM.

### O que custa — leia as três antes de começar

1. 🔴 **Você precisa de uma conta paga num servidor de mensagens, e ela é sua.** O CRM não fala
   com o WhatsApp direto: quem fala é um **servidor de mensagens** contratado por você, num
   fornecedor de fora. Sem essa conta este canal não existe — e o CRM não vem com nenhuma, nem
   contrata por você. Você vai precisar de **duas informações dela**: o **endereço** do servidor
   e o **token de administrador** da sua conta lá.
   **Se você não sabe qual contratar**, pergunte no suporte, na área de membros onde você
   comprou o CRM. É a pergunta certa para lá, não para esta seção: qual fornecedor usar é uma
   escolha comercial sua.
2. 🔴 **Cada clique em Conectar cria uma instância nesse servidor, e ela é cobrada por lá.**
   Conectar duas vezes cria duas. Apagar o canal no CRM apaga a instância dele junto — e
   reconectar aquele número depois cria **outra**, cobrada de novo. Por isso, quando um canal
   pareado para de receber, a primeira coisa a tentar é **Religar recebimento** (mais abaixo), e
   não Excluir.
3. **É um número de WhatsApp comum, com o risco que isso traz.** Este caminho conecta o seu
   número como se fosse mais um aparelho — não é uma conexão que o WhatsApp autorize
   oficialmente, e existe o risco de o número ser bloqueado por causa dela. É o preço de não
   passar pela Meta; o canal oficial (§6.5) não corre esse risco e cobra outros.

### Antes de começar

Em **Configurações → Canais**, no primeiro bloco (**Servidor de mensagens**), os dois campos
precisam estar preenchidos. Eles valem para o servidor inteiro e **só quem instalou o CRM** os
preenche:

| Campo no CRM | O que colar |
|---|---|
| **Endereço público deste CRM** | o endereço pelo qual você abre o CRM (ex.: `https://crm.suaempresa.com.br`). É por aqui que o servidor de mensagens entrega o que os seus clientes escrevem |
| **Token de administrador do servidor** | o token de administrador da **sua conta** no servidor de mensagens. Ele fica guardado criptografado e nunca mais aparece nesta tela |

Enquanto faltar um dos dois, o botão de conectar fica cinza e a própria tela diz qual deles
falta.

### O passo a passo

1. Em **Configurações → Canais**, clique em **WhatsApp (código de pareamento)**.
2. Preencha os dois campos:

   | Campo no CRM | O que colar |
   |---|---|
   | **Nome do canal** | é seu, escolha qualquer um (ex.: *Comercial*) |
   | **Endereço do servidor de mensagens** | o endereço da sua conta no servidor de mensagens (ex.: `https://servidor-de-mensagens.exemplo.com`) |

3. Clique em **Conectar**. 🔴 **É este clique que cria a instância cobrada.** O canal passa a
   aparecer na lista logo abaixo — **e o código de leitura ainda não aparece sozinho.**
4. Na linha do canal novo, clique em **Gerar código**.
5. O CRM mostra o **código de leitura** ali, junto com uma frase que nomeia o servidor com que o
   aparelho vai ser pareado. **Leia essa frase antes de apontar a câmera: se aquele endereço não
   é o seu, pare aqui.**
6. Com o celular do número em mãos:
   1. Abra o WhatsApp no celular do número deste canal.
   2. Toque em **Aparelhos conectados** e depois em **Conectar um aparelho**.
   3. Aponte a câmera para o código.

   O código vale por poucos segundos. Se expirar, clique em **Gerar código** de novo.

### O que este canal faz — e o que ele não faz

- **Ele recebe arquivo.** Foto, áudio, vídeo e documento enviados pelos seus clientes aparecem
  na conversa. É o único dos três canais que recebe arquivo nesta versão.
- **O CRM responde em texto**, aqui e nos outros dois canais.
- **Não existe a janela de 24 horas** que o canal oficial tem (§6.5): você responde um cliente
  quando quiser.

### Se o aparelho está pareado e mesmo assim nada chega em Conversas

Use **Religar recebimento**, na linha do canal. Ele avisa de novo o servidor de mensagens para
onde entregar, **sem criar outra instância cobrada** — que é o que aconteceria se você apagasse
o canal e conectasse de novo.

---

## 6.5 WhatsApp oficial da Meta (opcional)

O CRM conecta um número de WhatsApp de duas formas. **Se o seu WhatsApp já está funcionando por
código de pareamento, ele continua funcionando — não há nada a fazer aqui.** Esta seção é só
para quem quer trocar para o canal **oficial** da Meta.

### O que você ganha

Um número **oficial**, aprovado pela Meta. É o caminho que não depende de um aplicativo
não-oficial falando com o WhatsApp por fora, e por isso **não corre o risco de o número ser
bloqueado por isso**.

### O que custa — leia as três antes de começar

1. **Criar um aplicativo no painel da Meta e passar pela revisão dela.** É trabalho de uma vez,
   e é **um aplicativo por espaço de trabalho**: cada aplicativo tem uma única URL de retorno,
   então dois espaços de trabalho não podem dividir o mesmo.
2. 🔴 **O número deixa de funcionar no aplicativo WhatsApp — e no WhatsApp Business — do
   celular.** Quem atende hoje pelo aparelho perde isso: a partir daí as mensagens daquele
   número só entram e saem pelo CRM. **Voltar atrás não é um clique.** Se alguém da sua equipe
   responde clientes pelo telefone, decida isto com essa pessoa antes.
3. **Nesta versão o canal oficial recebe texto.** Foto, áudio e documento ficam para uma versão
   seguinte — mensagens desses tipos não aparecem na caixa de entrada.

### Antes de começar

Em **Configurações → Canais**, o campo **Endereço público deste CRM** precisa estar
preenchido (ex.: `https://crm.suaempresa.com.br`). É o endereço pelo qual a Meta entrega as
mensagens; sem ele o CRM não tem o que mostrar para você colar no painel dela. **Só quem
instalou o CRM** preenche esse campo.

O **token de administrador do servidor**, logo abaixo dele, é do outro tipo de canal — o oficial
não usa, e pode ficar vazio.

### O passo a passo

1. No painel da Meta (developers.facebook.com), abra o seu aplicativo e vá em
   **WhatsApp → Configuração da API**.
2. No CRM, abra **Configurações → Canais**, clique em **WhatsApp oficial (Meta)** e preencha:

   | Campo no CRM | Onde ele está no painel da Meta |
   |---|---|
   | **Nome do canal** | é seu, escolha qualquer um (ex.: *Comercial*) |
   | **Identificador do número (phone number ID)** | *WhatsApp → Configuração da API*, ao lado do número. **Não é o telefone** — é um número comprido de identificação |
   | **Token de acesso** | na mesma tela, botão de gerar token. Cole o token inteiro |
   | **Chave de assinatura do aplicativo (App Secret)** | *Configurações do aplicativo → Básico → Chave secreta do aplicativo* |
   | **Token de verificação** | **você inventa**. Uma senha longa qualquer; guarde-a, a Meta vai pedir o mesmo texto |

3. Clique em **Criar canal oficial**.

### Os dois valores que a tela mostra depois

Ao criar o canal, o CRM mostra **o endereço de recebimento** e **o token de verificação**.

> 🔴 **Copie os dois na hora.** O endereço de recebimento **não é mostrado de novo** e não há
> como descobri-lo depois — metade dele é um segredo que fica guardado cifrado. Se você perder,
> o caminho é apagar o canal e criar outro.

De volta ao painel da Meta, em **WhatsApp → Configuração → Webhook**:

- cole o endereço no campo **URL de callback**;
- cole o token no campo **Token de verificação**;
- clique em verificar e salvar, e **assine o campo `messages`** — sem essa assinatura a Meta
  aceita a configuração e nunca entrega mensagem nenhuma.

### Mais de um número oficial no mesmo aplicativo

Um aplicativo da Meta tem **uma única URL de retorno** para o WhatsApp, e ela vale para **todos
os números daquele aplicativo**. Isso é da Meta, não do CRM — não há como dar um endereço para
cada número lá.

O CRM funciona com isso. Faça assim:

1. **Crie o canal do segundo número normalmente**, aqui em *Configurações → Canais*, com o
   identificador do número, o token e as duas chaves do mesmo aplicativo.
2. **Não troque nada no painel da Meta.** Você vai receber um endereço de recebimento novo junto
   com o canal novo — **ignore-o** e deixe lá o endereço que você já tinha colado. Trocar faria o
   primeiro número parar de receber.
3. Pronto. As mensagens dos dois números chegam pelo mesmo endereço, e o CRM entrega cada uma na
   conversa do canal certo.

**Se as mensagens de um dos números não aparecerem**, a causa quase sempre é uma só: o canal
daquele número ainda não foi criado aqui. Em *Configurações → Canais*, o canal que **está**
recebendo mostra um aviso de **evento recusado** (no plural, quando foi mais de um) — é ele
avisando que chegou mensagem de um número que o CRM não reconhece.

**Isto vale só para números do MESMO aplicativo.** Dois espaços de trabalho continuam precisando
de aplicativos separados na Meta, pelo motivo da lista de custos acima: o endereço de retorno é
um só por aplicativo, e ele aponta para um espaço de trabalho.

### 🔴 A janela de 24 horas — a regra é da Meta, e ela surpreende

No canal oficial, **a Meta só aceita resposta livre por 24 horas depois da última mensagem do
cliente.** Passado esse prazo, só passa um modelo de mensagem aprovado por ela — e **esta versão
do CRM ainda não envia modelos**.

Na caixa de entrada, o CRM avisa quando esse prazo passou, num aviso acima do campo de resposta.
**Ele avisa, e só.** O campo continua editável e o botão continua clicável de propósito:

- o relógio do CRM é uma **cópia** do que a Meta tem, e quem decide na hora do envio é ela;
- se ela recusar, a mensagem aparece na conversa como **falhou**, com a explicação — nada se
  perde e o texto continua na tela;
- se o CRM bloqueasse por conta própria e a nossa cópia estivesse errada, você ficaria sem poder
  responder um cliente que a Meta teria aceitado.

**No canal por código de pareamento esse prazo não existe**, e o aviso não aparece.

---

## 6.6 Instagram — mensagens diretas (opcional)

O CRM pode receber e responder as **mensagens diretas do Instagram** na mesma caixa de entrada
do WhatsApp. **É opcional, e quem não quiser não muda nada:** sem fazer nada desta seção, o CRM
segue exatamente como está.

### O que custa — leia as cinco antes de começar

1. ✅ **A boa notícia primeiro: o aplicativo da Meta pode ser o MESMO.** Se você já ativou o
   WhatsApp oficial (seção 6.5), não precisa criar outro aplicativo — a chave de assinatura é a
   mesma.
2. 🔴 **A conta do Instagram precisa ser Profissional e estar ligada a uma Página do
   Facebook**, e nas configurações do Instagram as mensagens precisam estar liberadas para
   outros aplicativos. **A permissão do aplicativo é outra** (mensagens do Instagram, não a do
   WhatsApp), e ela passa pela revisão da Meta mesmo que o aplicativo já exista.
   **É aqui que a instalação mais trava — e não tem nada a ver com o CRM.** Resolva isto no
   painel da Meta antes de mexer no CRM.
3. **Nesta versão o canal recebe e envia texto.** Foto, áudio, figurinha e resposta a story
   ficam para uma versão seguinte — mensagens desses tipos não aparecem na caixa de entrada.
4. 🔴 **Mensagem que você envia fica como "enviada" para sempre.** Ela não avança para
   "entregue" nem para "lida": este canal não confirma entrega mensagem a mensagem, e o CRM não
   tem como saber se chegou. A caixa de entrada mostra esse estado, então quem atende vai
   perguntar — a resposta é esta, e não um defeito.
5. 🔴 **Se outro aplicativo estiver como receptor primário desta conta no painel da Meta, as
   mensagens não chegam ao CRM.** O Messenger tem um modo de entrega em espera: quando outro
   aplicativo é o dono principal da caixa de entrada, a Meta entrega as mensagens **a ele** e
   manda ao CRM só uma cópia em espera, que o CRM não transforma em conversa.
   **O sintoma é mudo dos dois lados:** o canal recebe zero mensagens e o contador de
   **recusados** dele **não sobe** — porque não há nada sendo recusado. Se você ligou tudo,
   verificou o endereço e mesmo assim nada chega, é isto: no painel da Meta, confira qual
   aplicativo está como receptor primário desta conta.

### Antes de começar

Em **Configurações → Canais**, o campo **Endereço público deste CRM** precisa estar
preenchido (ex.: `https://crm.suaempresa.com.br`). É o endereço pelo qual a Meta entrega as
mensagens; sem ele o CRM não tem o que mostrar para você colar no painel dela. **Só quem
instalou o CRM** preenche esse campo e cria este canal.

### O passo a passo

1. No painel da Meta (developers.facebook.com), abra o seu aplicativo e vá em
   **Instagram → Configuração da API**.
2. No CRM, abra **Configurações → Canais**, clique em **Instagram (Meta)** e preencha:

   | Campo no CRM | Onde ele está no painel da Meta |
   |---|---|
   | **Nome do canal** | é seu, escolha qualquer um (ex.: *Instagram da loja*) |
   | **Identificador da conta do Instagram (Instagram account ID)** | *Instagram → Configuração da API*, ao lado da conta. **Só números.** 🔴 **Não é o @ do perfil e não é o identificador da Página do Facebook** — o painel mostra mais de um número parecido, e colado o errado as mensagens chegam e são recusadas, sem entrar em Conversas |
   | **Token de acesso** | na mesma tela, botão de gerar token. Cole o token inteiro |
   | **Chave de assinatura do aplicativo (App Secret)** | *Configurações do aplicativo → Básico → Chave secreta do aplicativo*. É a mesma do WhatsApp oficial, se for o mesmo aplicativo |
   | **Token de verificação** | **você inventa**. Uma senha longa qualquer; guarde-a, a Meta vai pedir o mesmo texto |

3. Clique em **Criar canal do Instagram**.

### Os dois valores que a tela mostra depois

Ao criar o canal, o CRM mostra **o endereço de recebimento** e **o token de verificação**.

> 🔴 **Copie os dois na hora.** O endereço de recebimento **não é mostrado de novo** e não há
> como descobri-lo depois — metade dele é um segredo que fica guardado cifrado. Se você perder,
> o caminho é apagar o canal e criar outro.

De volta ao painel da Meta, em **Instagram → Configuração da API → Webhooks**:

- cole o endereço no campo **URL de callback**;
- cole o token no campo **Token de verificação**;
- clique em verificar e salvar, e **assine o campo `messages`** — sem essa assinatura a Meta
  aceita a configuração e nunca entrega mensagem nenhuma.

> 🔴 **O endereço de recebimento é um SEGREDO — trate-o como uma senha.** Metade dele é a chave
> que autentica cada mensagem que chega, então quem o tiver consegue consumir o limite de
> mensagens deste canal. Ele não vai em print de suporte, em grupo de WhatsApp nem em ferramenta
> de terceiro.

### O nome de quem escreve pode demorar a aparecer

O Instagram **não manda o nome nem o @** junto com a mensagem — só um número comprido que
identifica a pessoa. O CRM vai buscar o nome logo depois, sozinho, e a conversa passa a mostrá-lo.

Quando a permissão de mensagens ainda não está liberada, a Meta não devolve o nome: aí a conversa
continua com o número. **Não é defeito do CRM nem do seu servidor** — é o item 2 desta lista, no
painel da Meta.

---

## 6.7 Se o CRM ficar lento: **não aumente o número de cópias do aplicativo**

No EasyPanel existe um campo que diz quantas **cópias** do aplicativo devem rodar ao mesmo tempo
(ele aparece como *Replicas*, em inglês). O valor certo para o Awave CRM é **1** — e esta seção
existe porque subir esse número parece a resposta óbvia para "o CRM está lento" e cobra um preço
que não aparece em lugar nenhum da tela.

### O que muda quando existe mais de uma cópia

O endereço em que o WhatsApp e o Instagram entregam as mensagens fica **aberto para a internet** —
é assim que eles conseguem entregar, e é o endereço do CRM que mais recebe visita de fora: qualquer
pessoa que o descubra também consegue bater nele, sem senha nenhuma. Para que uma enxurrada de
mensagens não derrube o seu CRM nem encha o seu banco de dados, ele **conta as mensagens que chegam
e segura o excesso**.

Essa contagem vive na memória da cópia que atendeu a mensagem, e **cada cópia conta sozinha**. Com
três cópias, uma enxurrada passa **três vezes** antes de ser contida: entram três vezes mais
mensagens, três vezes mais contatos novos por hora, e o mesmo vale para o resto da proteção. Nada
avisa que isso aconteceu — a tela continua igual, e o único sinal é o volume que entrou.

E há um segundo efeito, mais fácil de notar: **as tarefas automáticas rodam uma vez em cada cópia**
— a fila de envio, o download de fotos e áudios, as respostas do assistente. Duas cópias fazem esse
trabalho duas vezes, ao mesmo tempo, disputando as mesmas linhas do banco.

### O que fazer quando ele estiver lento

- **Dê mais recursos à cópia que existe**, em vez de criar outra: no EasyPanel, aumente a memória e
  a CPU do serviço. É o caminho para o qual este CRM foi feito.
- **Confira o Supabase.** Lentidão quase sempre é o banco, não o aplicativo — o plano gratuito tem
  limites de conexão e de processamento, e o painel do Supabase mostra quando eles são atingidos.
- **Se mesmo assim você decidir usar mais de uma cópia**, decida sabendo: a proteção contra
  enxurrada de mensagens fica proporcionalmente mais fraca, e as tarefas automáticas passam a rodar
  em duplicidade. Não é uma configuração que o CRM proíbe — é uma que ele não tem como compensar
  sozinho.

---

## 7. Backup

**Tudo que importa está no seu Supabase** — os dados do CRM e as chaves guardadas no Vault. O
container não guarda nada: pode ser destruído e recriado sem perda.

**Com estes três itens você reconstrói o CRM inteiro do zero, em minutos:** o seu repositório
privado (§0), as três variáveis (§2.1) e o seu projeto Supabase.

⚠️ **No plano gratuito do Supabase NÃO existe backup automático** — a cópia diária é recurso
de plano pago. Ali a cópia é sua para fazer, e são **dois** comandos, contra a mesma
connection string do §1.1:

```bash
supabase db dump --db-url "<a sua SUPABASE_DB_URL>" -f estrutura.sql
supabase db dump --db-url "<a sua SUPABASE_DB_URL>" -f dados.sql --data-only --use-copy
```

O primeiro sozinho **não é um backup**: sem o `--data-only` do segundo sai só a estrutura, e
você restauraria um CRM com todas as tabelas certas e **nenhum cliente dentro**. Um `pg_dump`
contra a mesma string resolve os dois de uma vez. Nos planos pagos, *Database → Backups* já
tem as cópias diárias e o botão de baixar.

⚠️ **O backup do banco não leva os arquivos junto.** O logo, o ícone da aba e os **anexos dos
negócios** ficam no **Storage** do Supabase, um lugar separado do banco. Um dump traz o
registro de que o arquivo existe, não o arquivo.

> 📘 **Backup, privacidade e a lista do que sai do seu servidor:**
> <https://elitedaia.com.br/guia/crm/servidor/backup-e-privacidade>

### Arquivos (Storage)

Fotos, áudios e documentos que chegam pelo WhatsApp **não ficam no banco** — eles vão para o
*Storage* do seu Supabase, que tem cota própria (no plano gratuito, 1 GB no total). O backup do
banco **não leva esses arquivos junto**: para guardá-los, use *Storage → Download* no painel do
Supabase.

- Cada espaço de trabalho pode guardar até **500 MB** de anexos, e a instalação inteira até
  **800 MB** — a folga é do logo da tela de entrada, que mora no mesmo Storage.
- Quanto você já usa aparece em **Configurações → Canais**, logo abaixo da lista de canais.
- **Quando o espaço acaba, os anexos param de ser baixados** e aparecem como indisponíveis; o
  texto das mensagens continua chegando normalmente. Assim que sobrar espaço, o CRM volta a
  baixar sozinho — nada é perdido no caminho.
- Se um espaço de trabalho passar de **dez mil arquivos**, o CRM não consegue mais somar tudo de
  uma vez: a tela deixa de mostrar o número e passa a tratar o espaço como cheio, por segurança.
  O efeito é o mesmo do item acima (os anexos deixam de ser baixados, o texto continua). Para
  voltar a baixar, apague anexos antigos em *Storage* no painel do Supabase.
- O CRM faz uma limpeza automática por dia: ele apaga os arquivos que não pertencem mais a
  nenhuma mensagem (sobras de canal excluído) e o histórico interno mais antigo. **As suas
  conversas e os anexos que ainda estão numa mensagem não são tocados.**
  - A única exceção são as conversas de **teste** — as que você cria em *Agentes de IA →
    Testar o assistente* para experimentar como ele responde. As que você
    abandonou (clicou em *Limpar e recomeçar*) há mais de **7 dias** são apagadas; a que
    estiver aberta na tela fica, por mais antiga que seja.

#### Como guardar os arquivos — passo a passo

O CRM guarda arquivo em **três baldes** (*buckets*) dentro do *Storage*, e o backup só está
completo com os três:

| Balde | O que tem dentro |
|---|---|
| `canais-midia` | as fotos, os áudios, os vídeos e os documentos que os seus clientes mandam nas conversas |
| `anexos` | os arquivos que a sua equipe anexa aos negócios |
| `marca` | o seu logo e o ícone da aba |

1. No painel do Supabase, abra **Storage**, no menu da esquerda.
2. Clique no balde `canais-midia`. Dentro dele há uma pasta por espaço de trabalho.
3. Selecione o que está lá dentro e use **Download**. Se o painel não deixar baixar uma pasta
   inteira de uma vez, entre nela e baixe os arquivos.
4. Repita nos baldes `anexos` e `marca`.
5. Guarde o que baixou **junto** com a cópia do banco, na mesma pasta e com a mesma data. Os
   dois não servem separados: o banco diz que existe uma foto, e o balde **é** a foto.

**Para voltar**, é o caminho inverso: em *Storage*, abra o balde e use **Upload** mantendo os
nomes das pastas **exatamente** como estavam. O CRM procura cada arquivo pelo caminho gravado na
mensagem — pasta renomeada é arquivo que ele não encontra.

> 🔴 **E se você restaurar só o banco?** As conversas voltam inteiras e nenhum texto se perde. O
> que falta é o arquivo: onde havia uma foto, um áudio ou um documento, a conversa passa a
> mostrar só a indicação de que havia um anexo ali, e ele não abre. **Não aparece erro nenhum na
> tela, e não há como recuperar depois** — a cópia do banco nunca teve os arquivos dentro.

---

## 8. O app não subiu

**Comece pelo log** (EasyPanel → seu app → aba **Logs**). Duas famílias, e o caminho é
diferente:

- **Tem uma linha começando com `PROBLEMA`** → é config mal preenchida, e **o próprio log já
  diz o que fazer**: ele nomeia a variável, o que está errado e como resolver. Os casos são
  sempre os mesmos cinco — falta a connection string, ficou o `[YOUR-PASSWORD]`, você copiou a
  Direct connection, colou a mesma chave nos dois campos, ou trocou as duas de lugar.
- **Não tem `PROBLEMA` nenhum** (o log diz `[preflight] modo: normal`) → o CRM entendeu as
  suas variáveis; o que falhou foi outra coisa, quase sempre o **banco** recusando a conexão.
  Ele tenta três vezes antes de desistir, e **a mensagem que interessa é a de dentro dos
  parênteses**. Procure a sua aqui:

| No log | O que aconteceu | Como resolver |
|---|---|---|
| `password authentication failed for user "postgres..."` | **O erro nº 1.** Quase sempre você colou a senha **da sua conta Supabase** no lugar da **senha do BANCO**. | Refaça o §1.1. Se não lembra a senha do banco, gere outra em *Settings → Database → **Reset database password*** e cole a nova. |
| `Tenant or user not found` | O trecho `postgres.<código>` não bate com o projeto — típico de misturar valores de **dois projetos** Supabase. | Recopie a connection string do projeto certo (§1.1) e confira que as duas chaves são **do mesmo projeto**. |
| `ENOTFOUND` / `ETIMEDOUT` / `getaddrinfo` no host `...pooler.supabase.com` | O endereço não respondeu. Quase sempre o **projeto está pausado** (no gratuito o Supabase pausa depois de ~7 dias sem uso). | Abra o painel: se aparecer **Paused / Restore**, restaure, espere terminar e faça deploy de novo. |
| Build falha com `Killed` / erro de memória | A VPS não deu conta do build (acontece **antes** do log do CRM). Quase sempre uma VPS de **1 GB**. | Suba pra uma de **2 GB** (nota de infra no topo). |
| O CRM abre, mas o login não funciona / erro de permissão | Quase sempre a chave secreta está errada ou é de outro projeto. | Recopie a `SUPABASE_SERVICE_ROLE_KEY` do projeto certo (§1.3). |
| `Este banco de dados JÁ TEM tabelas do CRM` | Você apontou o CRM pra um banco **já usado por uma instalação anterior**. | Siga a §8.3 — a própria mensagem do log traz o SQL pronto. |

> 💡 **A boa notícia, antes de tudo:** em todos os casos acima o deploy **falha sem te
> derrubar**. Se o seu CRM já estava no ar, o EasyPanel mantém o container anterior servindo
> enquanto você conserta.
>
> 🔴 **E é por isso que, se o seu CRM JÁ está no ar, você não deve adicionar a
> `AWAVE_DIAGNOSTICO=1`.** Essa variável é você dizendo "pode subir, aqui não tem nada a
> proteger", e ela troca essa rede de segurança por uma página pública de diagnóstico.
>
> 🩺 **Como ligar, então** — só quando o CRM ainda **não** subiu nenhuma vez: adicione
> `AWAVE_DIAGNOSTICO=1` às variáveis do EasyPanel e faça deploy. Em vez de recusar o boot, o
> CRM sobe numa página que mostra as três variáveis com um certo ou um errado ao lado, e o
> que fazer em cada uma que falhou.
>
> 🧹 **E se usou, REMOVA assim que o CRM subir normal.** Não deixe pra depois: ela fica
> **adormecida** e só não faz nada porque, no momento, não há problema nenhum. No dia em que a
> sua configuração desenvolver qualquer problema — você trocar a senha do banco, o Supabase
> migrar as suas chaves pro formato novo, alguém colar um valor no campo errado — essa
> variável esquecida vira o gatilho, e derruba um CRM que estava funcionando.
>
> ⚠️ Na segunda família (log sem `PROBLEMA`) ela **não faz absolutamente nada**: você
> receberia exatamente o mesmo log de antes. Vá direto pela tabela acima.

A página de diagnóstico **nunca mostra o valor** de nenhuma variável — só se ela está
preenchida e se o formato bate. Você pode abri-la sem medo de expor as suas chaves.

> 📘 **A versão ilustrada, com as tabelas completas e o que levar para o suporte:**
> <https://elitedaia.com.br/guia/crm/servidor/quando-algo-trava>

### 8.3 "Este banco já tem tabelas do CRM"

Você vai ver isso só num caso: a `SUPABASE_DB_URL` aponta pra um banco que **já serviu uma
instalação do CRM antes** — porque você recriou o app no EasyPanel, migrou de servidor, ou
restaurou um backup — e nesse banco falta a tabela de controle `public.awave_migrations`.

**O container não sobe, e isso é proposital.** Sem essa tabela o instalador não tem como saber
o que já foi feito; se ele tentasse adivinhar, criaria de novo tabelas que já existem e
pararia no meio. Seus dados estão intactos — nada foi apagado.

**Como resolver (uma vez só):**

1. **Descubra em que versão esse banco parou.** Se a instalação anterior estava em dia, é a
   versão mais recente. Se você não sabe, **não chute** — peça suporte. Registrar uma
   atualização que na verdade não rodou faz ela ser **pulada para sempre**, e o CRM passa a
   rodar contra um banco incompleto, com erros que parecem bug.
2. Abra o **SQL Editor** do Supabase e cole o SQL que **o próprio log do container imprimiu**
   (ele já vem com a lista de versões desta versão do CRM), removendo as linhas das versões
   que esse banco ainda não tem.
3. Faça deploy de novo. O instalador aplica só o que faltar.

> Este caminho não aparece numa instalação nova: um projeto Supabase recém-criado está vazio,
> o instalador cria a tabela de controle sozinho e nada disso acontece.

> 💡 **A boa notícia:** em todos os casos do §8.2 o deploy **falha sem te derrubar**. Se o seu
> CRM já estava no ar, o EasyPanel mantém o container anterior servindo enquanto você
> conserta.

### 8.4 O assistente parou de responder uma conversa

Três situações tiram o assistente de uma conversa. Em **nenhuma** delas a conversa some da caixa
de entrada: ela continua na lista, com todas as mensagens, e você continua podendo responder
normalmente por ali. O que muda é só quem responde.

**1. Alguém da equipe respondeu pelo aplicativo do celular.** O CRM entende que uma pessoa entrou
na conversa e cala o assistente por **30 minutos**. Vencido o prazo, ele volta sozinho na próxima
mensagem do cliente — você não precisa fazer nada.

> ⚠️ **Isto não acontece no WhatsApp oficial da Meta** (§6.5): naquele tipo de número o aparelho
> sai do ar, então não há aplicativo de onde responder. Ali quem cala o assistente é o **Assumir**
> do item 3.

**2. O cliente pediu para falar com uma pessoa.** O assistente para de responder aquela conversa,
marca o pedido e a coloca no topo da lista para o time ver. Ele **não volta sozinho**: quando o
atendimento terminar, clique em **Devolver ao assistente**, na barra da conversa.

**3. Alguém do time assumiu a conversa.** Na caixa de entrada, escolher uma pessoa em **Assumir**
cala o assistente naquela conversa — e, ao contrário da pausa de 30 minutos do item 1, essa
**não vence sozinha**. A lista mostra `Assistente calado` com a data, para a conversa não ficar
esquecida. Para religá-lo, é o mesmo botão: **Devolver ao assistente**.

> 💡 **Devolver ao assistente** aparece na barra da conversa nos casos 2 e 3 — ou seja, quando há
> uma pessoa no comando. Ele não aparece no caso 1, e isso é de propósito: ali alguém está
> digitando pelo celular naquele instante, e religar o assistente o faria responder por cima
> dessa pessoa. Aquela pausa vence sozinha em 30 minutos.

Nenhuma mensagem se perde em nenhum dos três casos.

#### Se você desfez uma atualização e as conversas não voltaram

O botão **Desfazer** volta o **código**, não o **banco**. Depois de um Desfazer, uma conversa que
estava esperando uma pessoa — ou que alguém do time tinha assumido — pode não aparecer na caixa
de entrada, porque a versão anterior não sabe ler essas marcas.

Nenhuma mensagem se perdeu. Para trazê-las de volta, rode no SQL Editor do Supabase.

🔴 **Primeiro descubra o seu `workspace_id`.** Um mesmo servidor pode hospedar vários espaços de
trabalho, e os comandos abaixo mudam conversas. Sem este filtro eles escrevem no dado de **todos**
eles de uma vez. Rode:

```sql
select id, nome from public.workspaces;
```

Copie o `id` do espaço de trabalho que você quer consertar e use nos dois comandos abaixo, no
lugar de `COLE-AQUI-O-ID`.

```sql
-- 1. Traz de volta as conversas que estavam esperando uma pessoa.
-- Idempotente, sem perda de mensagem: o que se perde é a marca.
-- O responsável sai junto, e isso é obrigatório: uma conversa aberta que ainda tem alguém
-- anotado como responsável continua calada — o assistente não responde nela. Sem esta parte
-- o comando parece funcionar e não funciona.
update public.conversas
   set status = 'aberta', atribuida_a = null, assumida_em = null
 where workspace_id = 'COLE-AQUI-O-ID'
   and status = 'aguardando_humano';
```

```sql
-- 2. Traz de volta as conversas que alguém do time tinha assumido.
-- O `atribuida_a is not null` é obrigatório: sem ele, este comando também apagaria a pausa de
-- 30 minutos de quem está respondendo pelo celular NESTE momento, e o assistente passaria a
-- responder por cima dessa pessoa.
update public.conversas
   set status = 'aberta', atribuida_a = null, assumida_em = null
 where workspace_id = 'COLE-AQUI-O-ID'
   and status = 'assumida'
   and atribuida_a is not null;
```

⚠️ Os dois devolvem conversas ao assistente. Se ele estiver ligado, volta a responder essas
conversas na próxima mensagem do cliente.

**Não rode nenhum dos dois** para acelerar a pausa de 30 minutos descrita no caso 1: aquela se
desfaz sozinha, e nesta situação o comando não é necessário.

### 8.5 O app não subiu e o log fala em `vector`

O assistente automático guarda a base de conhecimento usando um recurso do banco de dados
chamado `vector`. Ele precisa estar guardado no lugar certo dentro do seu Supabase, e em
projetos antigos ele às vezes está em outro lugar.

**Na maioria dos casos o CRM resolve isso sozinho** e você nem fica sabendo. Se ele conseguiu,
o log traz uma linha como:

```
[migrate] pg: NOTICE [0030] extensao vector movida de public para extensions
```

Não há nada a fazer: o app sobe normalmente.

**Se ele não conseguiu**, o app não sobe — e o log diz qual dos dois casos abaixo é o seu. Eles
têm consertos diferentes, então confira a linha antes de escolher.

#### Caso A — o log traz `nao foi possivel mover a extensao vector`

```
[migrate] pg: WARNING [0030] nao foi possivel mover a extensao vector de public para extensions
```

O recurso existe no seu banco, só está guardado no lugar errado, e o CRM não teve permissão para
movê-lo. No painel do Supabase, abra o **SQL Editor** e rode:

```sql
alter extension vector set schema extensions;
```

E siga pela resposta que aparecer:

- **Deu certo, sem erro** → reinicie o app no EasyPanel (botão **Deploy**). Acabou.
- **A resposta fala em permissão ou em dono** (em inglês, algo como `must be owner of extension
  vector`) → mover não está ao seu alcance: quem habilitou o recurso foi o próprio painel, em
  nome de uma conta de sistema. Abra um chamado no suporte do Supabase pedindo, com estas
  palavras, *mover a extensão `vector` para o schema `extensions`*. Esse é o pedido inteiro —
  não há mais nada a explicar para eles. Quando responderem, reinicie o app no EasyPanel.
- **A resposta diz que a extensão não existe** → seu caso é o B, logo abaixo.

#### Caso B — o log traz `Este banco nao oferece a extensao vector`

```
[preflight] PROBLEMA (banco): Este banco nao oferece a extensao `vector`
```

O recurso não está habilitado neste projeto. Vá em **Database → Extensions**, procure `vector`
na lista e habilite. Depois reinicie o app no EasyPanel (botão **Deploy**).

Se `vector` não aparecer nem na lista, o projeto do Supabase é antigo demais: abra um chamado no
suporte deles pedindo a atualização da lista de extensões.

> 💡 Como no §8.2, o deploy **falha sem te derrubar**: se o seu CRM já estava no ar, o EasyPanel
> mantém a versão anterior servindo enquanto você conserta.
