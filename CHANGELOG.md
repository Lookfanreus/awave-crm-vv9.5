# Changelog — Awave CRM

Formato: uma seção por release, mais nova em cima. Escrito **pro comprador**, não pro
desenvolvedor — quem lê isto quer saber o que muda na tela dele, não qual arquivo mudou.

A versão que você está rodando aparece no rodapé de **Configurações**. É por ela que você
sabe qual seção abaixo é a sua.

---

## v0.9.5 — o motivo da perda volta a poder ser digitado no quadro

### Corrigido

- **Digitar o motivo da perda direto no quadro travava o arrastar.** No menu ⋮ do cartão, em
  *Marcar como perdido*, o primeiro espaço digitado era engolido, e o quadro ficava preso até
  recarregar a página: o cartão mexido não arrastava mais, e arrastar outro puxava o texto dele.
  O mesmo acontecia com quem usa o menu pelo teclado: Espaço ou Enter sobre um item do menu não
  acionava o item. Agora as teclas ficam no menu, e o Esc continua fechando como antes. Pela
  ficha do negócio o fluxo sempre funcionou, e nada muda lá.

---

## v0.9.4 (a marca não some num soluço de rede, e o relógio lê o banco bem menos)

Versão de correção. As quatro mudanças saíram da revisão da v0.9.3: são ajustes no que aquela
versão entregou, cada um medido antes de ser corrigido.

### Corrigido

- **Um soluço do banco ou da rede fazia toda tela mostrar a marca padrão por um minuto**, no
  lugar do nome, da cor e do logo que você configurou. A v0.9.3 passou a guardar a marca por um
  minuto para poupar o banco, e guardava também o resultado de uma leitura que tinha falhado.
  Agora só aquela requisição cai no padrão. A seguinte vai ao banco de novo, e a sua marca volta.

- **O relógio interno relia três configurações a cada batida**, mesmo sendo valores que mudam
  no máximo a cada 15 minutos. Agora elas ficam em memória por 15 minutos. Um CRM parado com o
  relógio no padrão de 30 segundos passa de até 8.640 dessas leituras por dia para no máximo
  288, e o ganho vale para qualquer intervalo até 15 minutos.

- **A consulta de avisos de prazo do quadro é feita em partes menores.** A v0.9.3 já a tinha
  dividido em blocos de 200 negócios, mas cada bloco ainda chegava a 98% do tamanho aceito na
  frente do banco. Agora são 90 por vez: o pedido fica em menos da metade do limite, com folga
  para crescer. A consulta das automações, que tem a mesma forma, segue a mesma regra.

### Novo na documentação

- **`HEARTBEAT_INTERVAL_MS` agora tem um teto escrito.** Se você usa os ganchos de evento da
  pasta `custom/eventos`, o banco só guarda esses eventos enquanto o relógio avisa, a cada
  batida, que eles estão ligados, e cada aviso vale por 1 hora. Com mais de 1 hora entre uma
  batida e outra, os eventos do intervalo são descartados, sem erro e sem registro. Recomendação:
  no máximo `1800000` (30 minutos). O servidor avisa no log, na hora em que sobe, quando o valor
  passa do teto. Detalhes no `.env.example` e em `docs/DEPLOY.md`, seção 2.4.

---

## v0.9.3 — o servidor para de reiniciar sozinho, e o banco trabalha menos

Versão de correção, e todas vieram de relatos em *Reportar bugs* feitos com medição — obrigado a
quem mediu antes de reportar: foi o que encurtou o caminho.

### Corrigido

- **O servidor reiniciava sozinho a cada três ou quatro dias.** A memória crescia até acabar e o
  EasyPanel reiniciava o container em segundos, então quase ninguém percebia — o sinal no log era
  "Gateway Timeout" e "tick anterior ainda rodando", que parecem o Supabase fora do ar e não são.
  A causa era uma conexão interna com o banco que deixava um pedaço de memória preso a cada uso.
  Agora ela é liberada, e o servidor fica estável.

- **Cada tela aberta fazia quatro consultas ao banco só para ler o nome, a cor e o logo.** Agora é
  uma consulta, e o resultado fica guardado por um minuto. Mudanças feitas em *Configurações*
  continuam aparecendo na hora.

- **A limpeza da fila de eventos da personalização rodava a cada 30 segundos**, mesmo sem nada
  para limpar. Agora roda uma vez por dia.

- **Quadros com muitos negócios abertos podiam perder os avisos de prazo sem erro nenhum na tela.**
  A consulta crescia com o número de negócios até passar do limite de tamanho aceito na frente do
  banco. Agora ela é feita em partes, e o quadro pequeno continua com uma consulta só.

- **A chave do primeiro acesso aparecia no log a cada vez que o servidor subia**, mesmo muito
  depois de a conta do dono existir. Ela já não servia para nada nesse estado, mas parecia uma
  credencial viva. Agora só aparece enquanto ainda é necessária.

- **Para quem escreve testes sobre o código:** o arquivo de configuração dos testes apontava para
  um arquivo que não vinha no pacote, e qualquer teste da parte do servidor falhava antes de
  começar. Corrigido.

### Novo na documentação

- **`HEARTBEAT_INTERVAL_MS`** agora está no `.env.example` e no guia de instalação. É a variável que
  mais mexe no consumo do seu banco: o relógio interno responde por cerca de 84% das consultas de
  um CRM parado. Se você está perto da cota gratuita do Supabase, subir para `300000` (5 minutos)
  derruba o consumo para cerca de um quarto — o preço é as automações e o assistente responderem
  com até esse atraso. Detalhes em `docs/DEPLOY.md`, seção 2.4.

---

## v0.9.2 — a mídia que o cliente manda volta a aparecer

### Corrigido

- **Foto, áudio e arquivo enviados pelo cliente não apareciam nas Conversas** — a conversa
  mostrava "Não foi possível baixar o arquivo" no lugar. Isso acontecia em **todo canal de
  WhatsApp conectado pela UAZAPI**, desde que as Conversas existem.

  O motivo: quando o cliente manda uma foto, a UAZAPI avisa o CRM com um endereço que aponta
  para o servidor de mídia do próprio WhatsApp, e não para o servidor da sua instância. O CRM só
  aceita baixar arquivo do endereço do seu canal — é a trava que impede alguém de nos fazer
  buscar arquivo em qualquer lugar da rede. Como o endereço não batia, o download era recusado
  antes de começar. Agora o CRM pede o arquivo à sua instância, que o devolve já legível e
  hospedado no seu servidor: a trava continua inteira, e com ela o limite de tamanho e o espaço
  reservado por conta.

  **O que já chegou também volta.** Ao atualizar, as mídias dos últimos 30 dias marcadas como
  indisponíveis voltam para a fila e são baixadas sozinhas, aos poucos — não precisa fazer nada.
  Pode levar alguns minutos até as primeiras aparecerem. Mídia mais antiga que isso fica de
  fora: quanto mais velha a mensagem, menor a chance de o arquivo ainda existir para ser
  buscado.

  Quem usa o canal oficial do WhatsApp (API da Meta) nunca teve esse problema, e nada muda.

  ℹ️ **Enviar** foto, áudio e arquivo *pelo* CRM continua não existindo — o campo de resposta
  manda texto. Isso é pedido de melhoria, não parte desta correção.

---

## v0.9.1 — as conversas voltam a chegar

Esta versão é só de correções, e **todas as nove vieram de posts em *Reportar bugs***. Obrigado a
quem escreveu — vários relatos vieram com passo a passo e medição, e foi isso que encurtou o
caminho até a causa.

### Corrigido

- **Reinstalar o CRM reusando o mesmo projeto Supabase podia deixar o sistema sem abrir.** Se
  você "limpou o banco" apagando o schema em vez de criar um projeto novo, o login funcionava mas
  qualquer tela dava erro de servidor. O motivo é sutil: apagar o schema leva junto as permissões
  padrão do Supabase, e as tabelas recriadas depois nasciam sem permissão nenhuma — e o CRM nunca
  as concedia por conta própria, contava com o padrão. Agora ele concede explicitamente, tanto
  para as tabelas de hoje quanto para as que vierem em versões futuras.

  Isso vale para qualquer coisa que recrie o schema, não só reinstalação: restauração de backup
  parcial, ferramenta de migração, ou um roteiro de "resetar o banco".

  🔴 **Se o seu CRM está NESTE estado agora, ele não consegue se consertar sozinho** — sem
  conseguir abrir as telas, não há como clicar em Atualizar. Rode isto uma vez no *SQL Editor* do
  Supabase e o produto volta; depois é só atualizar normalmente:

  ```sql
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  grant execute on all functions in schema public to service_role;
  ```

  Relatado na comunidade — e o autor chegou sozinho à causa, o que encurtou muito o caminho.
- **As conversas do WhatsApp por código de pareamento voltam a chegar.** Se o seu canal aparecia
  **Conectado**, o número recebia mensagens normalmente e a tela **Conversas** ficava vazia — com
  o contador de *eventos recusados* subindo em *Configurações → Canais* —, era isto. O CRM
  entendia só uma das duas formas que o servidor uazapi usa para se identificar, e descartava
  tudo que vinha na outra — que é justamente a forma usada nos eventos de **mensagem**. Nada é
  preciso fazer: as mensagens novas entram sozinhas. **As que foram descartadas não voltam** —
  elas nunca chegaram a ser gravadas.

  E, quando um evento for mesmo recusado, o registro do servidor passa a dizer **qual** conferência
  falhou. Isso não aparece na tela, mas é o que permite ao suporte responder em minutos em vez de
  pedir testes.

- **A caixa de entrada cabe na tela do celular.** Na conversa aberta, a linha com *Assumir*,
  *Virar negócio* e *Arquivar* estourava a largura em telas estreitas: o fim dela saía para fora,
  e era justamente ali que ficava o **Arquivar**. Agora ela quebra em mais de uma linha.

- **Buscar e filtrar conversas avisam quando não conseguem rodar.** Antes, se o pedido falhasse
  — sessão expirada, uma oscilação de rede —, a lista anterior continuava desenhada no lugar do
  resultado, sem nada indicando isso: quem digitava um nome lia a lista de antes como se fosse a
  busca. Na troca entre *ativas* e *arquivadas* era pior, porque o seletor já mostrava a opção
  nova sobre a lista antiga. Agora aparece um aviso acima da lista dizendo o que está sendo
  mostrado de verdade, e ele some sozinho assim que a tela volta a falar com o servidor.

- **Buscar por `%`, `_` ou `*` deixa de devolver a lista inteira.** Esses caracteres eram lidos
  como "qualquer coisa" pela busca, então digitá-los parecia não filtrar nada — em Conversas,
  Contatos, Empresas e nas listas. Agora eles são procurados como texto comum.

- **O *Arquivar* deixa de confirmar o que não fez.** Se a conversa já tivesse sido apagada por
  outra pessoa (ou noutra aba), o botão dizia que tinha dado certo e tirava a linha da tela sem
  nada ter sido gravado. Agora ele avisa que a conversa não existe mais — a mesma frase que o
  *Assumir*, ao lado, já dava.

- **A falha ao enviar diz o que fazer, quando dá para dizer.** Três situações mostravam
  *"tente de novo"* — e tentar de novo nunca ia funcionar em nenhuma delas: o canal ainda sem o
  endereço do servidor de mensagens, a conversa apagada e o canal apagado. Agora cada uma diz o
  que aconteceu e onde resolver. O texto digitado continua no campo, como antes.

- **As conversas em tempo real voltam a chegar sozinhas.** A tela continuava correta porque relê
  por conta própria de tempos em tempos, mas o aviso instantâneo não estava chegando — o efeito
  era a caixa de entrada demorar para mostrar mensagem nova.

- **A busca da caixa de entrada explica o que ela não alcança.** O texto que aparece quando nada
  é encontrado prometia achar conversa pela chave — o que a busca nunca fez. Agora ele diz o que
  é verdade: a procura é pelo **nome do contato**, dentro do conjunto que está sendo mostrado.

---

## v0.9.0 — os agentes de IA saem de dentro das Configurações

### Melhorado

- **O seu repositório agora tem um `.env.example`.** É a lista das três variáveis que o CRM
  precisa (`SUPABASE_DB_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), pronta para
  copiar e colar na aba **Environment** do EasyPanel. O CRM não lê esse arquivo — copiá-lo para
  `.env` não configura nada: a configuração continua sendo só o painel do seu servidor, como
  sempre foi, e nada muda para quem já está instalado.

- **O assistente saiu de dentro de Configurações e virou item próprio do menu: *Agentes de
  IA*.** Ele fica na seção *Automação e análise*, ao lado de *Automações*. Antes era preciso
  saber que ele existia para achá-lo: era um cartão dentro de *Configurações*, três cliques
  abaixo da tela inicial.

  A tela também deixou de ser uma rolagem única de seis blocos e passou a ter três abas:
  **Agentes** (a lista, e é onde você escreve como cada um fala e em que número ele atende),
  **Atendimento** (o horário da sua empresa e quanto o assistente custou no mês) e
  **Servidor** (a chave da conta de inteligência artificial e o modelo — só quem instalou o
  CRM vê esta).

  ⚠️ **O endereço antigo deixou de existir.** Se você tinha `/config/agente` nos favoritos, ele
  passa a dar página não encontrada — use o item do menu. O cartão em *Configurações* continua
  lá e leva para o endereço novo, então quem decorou o caminho antigo continua chegando.

  **Nada muda no funcionamento do assistente.** Os agentes que você já tinha, a chave, o
  horário e os números ligados continuam exatamente como estavam.

- **A *Base do assistente* passou a se chamar *Base de conhecimento*** no menu lateral — que é
  como a própria tela já se chamava. Mesma tela, mesmo conteúdo, mesmo endereço.

### Sobre os caminhos que as versões antigas citam

As seções da **v0.8.0**, mais abaixo, mandam ir em **Configurações → Assistente** (e em
*Configurações → Assistente → Base de conhecimento* e *→ Testar o assistente*). Aquilo era
verdade quando foi escrito e continua registrado como estava — mas, desta versão em diante, o
assunto tem casa própria no menu lateral:

- **Configurações → Assistente** é hoje **Agentes de IA** (seção *Automação e análise*);
- o custo do mês e o horário de atendimento ficam em **Agentes de IA → Atendimento**;
- a chave da conta de inteligência artificial e o modelo, em **Agentes de IA → Servidor**;
- *Testar o assistente* é **Agentes de IA → Testar o assistente**;
- *Base de conhecimento* já era item próprio do menu, e continua onde estava.

---

## v0.8.3 — o CRM para de gastar o seu banco à toa

### Corrigido

- **Automações de tempo faziam milhares de consultas desnecessárias ao seu banco, todo dia.** Se
  você usa uma automação do tipo *"negócio parado há N dias"* ou *"atividade vencida"*, o CRM
  reprocessava a cada ciclo **todos** os negócios que já tinham sido tratados — sem mudar nada,
  só gastando. Numa instalação real isso deu **495 mil requisições por dia** (93% de todo o
  tráfego daquele projeto) e **11,8 GB de tráfego por mês**, o suficiente para estourar a cota do
  plano gratuito do Supabase e, no limite, deixar o CRM fora do ar. Nada aparecia na tela: só na
  conta. Agora o CRM verifica antes o que já foi tratado, e refaz apenas o que é novo.

  **Nada muda no funcionamento das suas automações** — elas disparam exatamente nas mesmas
  situações, inclusive quando um negócio volta a se enquadrar depois de mudar de etapa. Se você
  chegou a desligar uma automação por causa do consumo, pode ligar de novo depois de atualizar.

### Melhorado

- **Os limites do `custom/menu.ts` agora estão escritos onde você lê.** Se você monta itens
  próprios no menu lateral, cinco regras podiam fazer um item sumir sem nenhuma mensagem: o
  máximo é **10 itens**; `titulo` acima de **40** caracteres e `caminho` acima de **200** fazem o
  item **desaparecer inteiro** (não é cortado); `grupo` acima de **24** cai em "Personalizado" e
  um `icone` fora da lista cai no padrão — nesses dois o item continua aparecendo.

  Nada disso mudou de comportamento: o que mudou é que os limites passaram a estar no comentário
  do próprio `custom/menu.ts`, no `custom/LEIA-ME.md` e no `AGENTS.md`. O comentário antigo dizia
  só *"até 40 caracteres"*, o que fazia esperar um corte — e o item simplesmente sumia.

  ⚠️ **Se você já usa a pasta `custom/`, o seu `custom/LEIA-ME.md` e o seu `custom/menu.ts` não
  são substituídos pela atualização** — é o que protege o seu código. A lista completa está acima
  e também no `AGENTS.md`, que é atualizado junto com o produto.

  🔴 **Nunca apague o seu `custom/menu.ts`.** Ele é o arquivo onde os seus itens de menu estão
  escritos: apagá-lo faz o CRM recriar o modelo em branco na próxima atualização, e **a sua
  configuração de menu some** — sem erro e sem aviso. Se quiser o texto novo de referência, copie
  a lista desta nota (ou leia no `AGENTS.md`) e mantenha o seu arquivo.

  O `custom/LEIA-ME.md` é diferente: ele é só documentação, não guarda configuração nenhuma.
  Quem quiser a versão nova pode apagar o seu antes de atualizar, sem perder nada.

  Reportado na comunidade por quem reproduziu com 12 itens e mediu o resultado.

---

## v0.8.2 — a tela não cai mais ao enviar um logo pesado

### Corrigido

- **Enviar um logo pesado derrubava a página inteira.** Em *Configurações → Servidor → Marca*,
  escolher uma imagem acima de 1 MB e clicar em *Enviar* trocava a tela por um erro em inglês
  (*"This page couldn't load"*), sem dizer o que tinha acontecido nem o que fazer — mesmo com a
  própria tela avisando que o limite é 512 KB. Agora a imagem grande é recusada na hora, com a
  mensagem de sempre (*"Imagem muito pesada — o limite é 512 KB"*), e a página continua onde
  estava. Vale para o logo e para o ícone da aba. Relatado na comunidade, com o passo a passo de
  como reproduzir.

---

## v0.8.1 — o quadro para de dizer uma coisa e fazer outra

Três correções no quadro de negócios, todas da mesma família: **a tela afirmava uma coisa e o
banco tinha feito outra.** As três foram relatadas por um comprador, com o passo a passo de
como reproduzir. Se você usa o quadro todo dia, vale atualizar.

### Corrigido

- **Arrastar um cartão podia mover o negócio de verdade e a tela dizer que não moveu.** Quando
  o arrasto falhava no meio, o cartão voltava para o lugar e aparecia *"não foi possível
  mover"* — mas em alguns casos a mudança de etapa **já tinha sido gravada**. Pior: quem liga o
  CRM a outro sistema pelo webhook de saída recebia o aviso de mudança de etapa de um cartão
  que o CRM acabara de dizer que não mudou, e tentar de novo mandava um segundo aviso. Agora a
  troca de etapa é a última coisa que o CRM grava: se algo falhar, nada mudou e a mensagem de
  erro é verdade.
- **O que você digitava na criação rápida do quadro podia sumir sem aviso.** No campo *+
  Adicionar* de uma coluna, o texto só era salvo com Enter — não havia botão de confirmar, e o
  próprio *+ Adicionar* fica escondido enquanto o campo está aberto. Quem digitava e clicava em
  outro lugar via o texto continuar ali, parecendo um cartão criado, e ele desaparecia ao mudar
  de tela. **Agora sair do campo com texto cria o negócio.** Para desistir, use Esc.
- **Desfazer no quadro podia trazer de volta um cartão que você tinha acabado de fechar.**
  Quando uma ação era recusada (por exemplo, marcar como ganho um negócio com campo obrigatório
  em branco), o quadro voltava ao estado de alguns segundos antes — e desfazia junto qualquer
  coisa feita nesse intervalo. Um negócio ganho com sucesso reaparecia como aberto, e só sumia
  de novo ao recarregar a página. Agora o desfazer devolve **apenas** o cartão da ação que
  falhou.

## v0.8.0 — as conversas dos seus clientes entram no CRM

**Esta versão traz as conversas dos seus clientes para dentro do CRM.** O WhatsApp e as
mensagens diretas do Instagram passam a ter uma caixa de entrada aqui — **Conversas**, no menu
—, ligada ao contato de sempre. E, se você quiser, um **assistente automático** responde
sozinho enquanto a equipe não pode.

**Nada disso liga sozinho.** Todo canal e todo assistente nasce desligado, e cada um depende de
uma conta sua fora do CRM. Quem não conectar nenhum número tem o CRM exatamente como ele está
hoje: contatos, funil, atividades, campos, automações e relatórios não mudaram.

### Adicionado

- **Conversas — o WhatsApp dentro do CRM.** Um item novo no menu. A mensagem do cliente chega,
  vira uma conversa ligada ao contato dele, e você responde da própria tela — sem trocar de
  aplicativo e sem perder o histórico quando quem atendeu sai de férias.
  - **O canal padrão é o do código de pareamento**, aquele em que você aponta a câmera do
    celular para um código e o número que a sua equipe já usa continua funcionando no aparelho.
    🔴 **Ele depende de uma conta paga sua num servidor de mensagens** — um serviço de fora,
    contratado por você — e **cada clique em Conectar cria uma instância cobrada por lá**. O
    guia de instalação (`docs/DEPLOY.md`) ganhou a seção **WhatsApp por código de pareamento**,
    com os três custos **antes** do passo a passo.
  - **Ele recebe arquivo:** foto, áudio, vídeo e documento aparecem dentro da conversa. Os
    arquivos ocupam espaço no seu Supabase, e a tela de Canais mostra quanto você já usa;
    quando o espaço acaba, o texto continua chegando e o anexo aparece como indisponível.
  - **A lista tem busca, "Carregar mais conversas" e um alternador entre *Conversas ativas* e
    *Conversas arquivadas*** — arquivar tira a conversa da frente sem esconder o histórico
    dela. Ela volta para as ativas quando o cliente escreve de novo, ou assim que você responde
    por ali.
  - **A conversa abre nas mensagens mais recentes**, tem "Ver mensagens anteriores" para o
    histórico antigo, e acompanha a mensagem que chega **sem tirar você do lugar** quando você
    está lendo mais para cima. O que você digitou fica guardado **em cada conversa**: trocar de
    conversa não leva o rascunho junto.
  - **A tela se atualiza sozinha**, e continua se atualizando mesmo em servidores onde o canal
    ao vivo não sobe — nesse caso ela confere o servidor por conta própria. Só aparece aviso
    quando ela perde contato de verdade.
  - **O desfecho de cada mensagem está em português** ("na fila", "entregue", "falhou"), e
    quando um envio falha o motivo aparece embaixo da mensagem, com o seu texto intacto na
    tela. Uma resposta que demora a ser confirmada é marcada para conferência em vez de ser
    reenviada — ninguém recebe a mesma mensagem duas vezes.
  - **Apagar um canal pede confirmação e diz tudo o que vai junto:** o canal, as conversas
    dele, as mensagens e os arquivos — e, no canal por código de pareamento, também a instância
    no servidor de mensagens, que precisa ser criada (e cobrada) de novo para reconectar aquele
    número. Se o problema for um canal que parou de receber, a própria confirmação lembra que
    **Religar recebimento** resolve sem apagar nada.

- **WhatsApp oficial da Meta (opcional).** Além do canal por código de pareamento, o CRM
  conecta um número **oficial**, aprovado pela Meta. **Trocar é decisão sua** — nada obriga a
  sair do outro caminho.
  - O que ele cobra, em ordem de surpresa: uma revisão do aplicativo no painel da Meta e, acima
    de tudo, **o número deixa de funcionar no aplicativo WhatsApp — e no WhatsApp Business — do
    celular**. Quem atende pelo aparelho perde isso, e voltar atrás não é um clique. Nesta
    versão o canal oficial **recebe texto**: foto, áudio e documento ficam para depois.
  - **A janela de 24 horas.** Nesse tipo de número a Meta só aceita resposta livre por 24 horas
    depois da última mensagem do cliente. A caixa de entrada avisa quando o prazo passou — e
    **avisa, só**: o campo de resposta continua aberto, porque o relógio do CRM é uma cópia e
    quem decide é a Meta. Se ela recusar, a mensagem aparece como **falhou**, com a explicação,
    e o seu texto continua na tela. No número por código de pareamento esse prazo não existe.
  - **Dois números oficiais no mesmo aplicativo da Meta funcionam.** O painel da Meta tem um
    endereço de retorno só por aplicativo; crie o canal do segundo número normalmente e
    **não troque nada lá** — as mensagens dos dois chegam pelo mesmo endereço e o CRM entrega
    cada uma na conversa certa.
  - O guia de instalação (`docs/DEPLOY.md`) ganhou a seção **WhatsApp oficial da Meta**, com o
    passo a passo e os quatro valores que você cola.

- **Mensagens diretas do Instagram (opcional).** O CRM passa a receber e responder as mensagens
  diretas do Instagram na mesma caixa de entrada do WhatsApp. **Quem não quiser não muda nada:**
  sem criar o canal, o CRM segue exatamente como está.
  - **O aplicativo da Meta pode ser o mesmo** de quem já ativou o WhatsApp oficial — mas a
    permissão é outra e passa pela revisão dela, e a conta precisa ser Profissional e ligada a
    uma Página do Facebook. É onde a instalação mais trava, e é tudo no painel da Meta.
  - Nesta versão o canal **recebe e envia texto**; foto, áudio, figurinha e resposta a story
    ficam para depois. E **mensagem enviada fica como "enviada"**: este canal não confirma
    entrega mensagem a mensagem.
  - O Instagram não manda o nome de quem escreve junto com a mensagem — só um número comprido.
    O CRM busca o nome logo depois, sozinho; quando a Meta não o libera, a conversa continua
    mostrando o número.
  - O guia de instalação (`docs/DEPLOY.md`) ganhou a seção **Instagram — mensagens diretas**,
    com o passo a passo, os cinco custos e o que conferir quando **nada** chega.

- **Assistente automático no WhatsApp (opcional).** O CRM pode responder sozinho as mensagens
  enquanto a equipe não pode. Ele **nasce desligado em todo número** e continua desligado depois
  de atualizar — ligar é sempre uma decisão de quem instalou o CRM.
  - Exige uma conta paga de inteligência artificial, que é **sua**, e ela é a **segunda** conta
    da história: a primeira é a do canal, sem a qual não há WhatsApp nenhum no CRM. Sem a conta
    de inteligência artificial, tudo o mais continua igual — as conversas chegam e são
    respondidas pela sua equipe, como sempre.
  - ⚠️ **Ao ligar, o conteúdo das conversas daquele número passa a ser enviado para a OpenAI
    (Estados Unidos) para gerar as respostas — inclusive o que os seus clientes escreverem.**
    Enquanto ele estiver desligado, nada sai do seu servidor.
  - **Ele se identifica como assistente automático** e explica como pedir uma pessoa. Numa
    conversa que dure semanas, ele volta a se identificar a cada 30 dias — quem conversa hoje
    com o seu negócio precisa saber com quem está falando, mesmo que a primeira mensagem tenha
    sido no mês passado.
  - **Quem pede uma pessoa é atendido na hora:** o assistente para de responder naquela conversa
    e ela passa a esperar alguém do seu time. Isso vale escrito de várias formas — "falar com
    atendente", no plural, com espaço a mais ou com quebra de linha.
  - **A resposta sai formatada como o WhatsApp entende.** Lista e negrito chegam limpos, e não
    com os símbolos à mostra. Resposta longa sai em partes, **na ordem** — o cliente nunca
    recebe a resposta começando pelo meio.
  - Configurações → Assistente mostra quanto ele custou no mês. O guia de instalação
    (`docs/DEPLOY.md`) tem a seção **Assistente automático**, com o que ligar significa para as
    conversas dos seus clientes.

- **Mais de um assistente por espaço de trabalho.** Dá para ter um assistente para cada número —
  um para vendas, outro para o pós-venda —, cada um com a própria personalidade e a própria
  descrição do negócio. **Quem tem um só não muda nada:** o assistente que você já tinha
  continua igual, marcado como **padrão**, e todo número sem escolha responde com ele.
  - Em **Configurações → Assistente**, cada assistente mostra numa linha **em quais números ele
    atende** — e o número que ninguém escolheu diz, ali mesmo, que está usando o padrão. Assim
    dá para ver de relance o assistente que você criou e esqueceu de atribuir a algum número.
  - **Escolher o assistente de um número não liga nada.** Ligar e desligar o assistente num
    número continua sendo de quem instalou o CRM; escolher quem responde é de quem administra o
    espaço de trabalho.
  - Excluir um assistente avisa antes **quantos números vão voltar a responder com o padrão**. O
    assistente padrão e o último de todos não podem ser excluídos: sem nenhum, o assistente
    responderia sem saber nada do seu negócio.
  - ⚠️ **Se você desfizer esta atualização**, a versão antiga volta a ler os assistentes do jeito
    antigo: a personalidade volta ao texto que tinha no dia da atualização e os assistentes
    criados depois deixam de responder. Nada é apagado — tudo volta a valer ao atualizar de
    novo. A tela do Desfazer avisa isso antes do clique.

- **Uma base de conhecimento: é de lá que saem preço, prazo e política.** Em **Configurações →
  Assistente → Base de conhecimento** você escreve, em texto comum, o que o assistente precisa
  saber para responder — a tabela de preços, o prazo de entrega, a política de troca. **Sem
  isso ele responde que não sabe**, e é a diferença entre um assistente útil e um que só dá
  bom-dia.
  - Cada entrada pode ser **desligada** sem ser apagada — ela sai das respostas e o texto fica
    guardado. Apagar de vez pede confirmação e lembra disso.
  - **Editar leva você até o formulário**, que fica no alto da página — com a lista cheia, você
    não precisa procurar onde o texto foi parar.
  - Quando o CRM não consegue ler a base, a tela **diz isso**, com todas as letras.

- **A base de conhecimento pode ser recortada por assistente.** Com mais de um assistente por
  espaço de trabalho, cada entrada da base pode valer para **todos** (o padrão — quem tem um só
  não muda nada) ou só para **alguns**: uma política de um assistente que não deve valer para
  outro, por exemplo. A escolha fica no formulário de escrever/editar a entrada, em
  **Configurações → Assistente → Base de conhecimento** — e cada assistente, na lista de
  Configurações → Assistente, agora mostra **quantas das entradas ligadas da base ele vê**
  (entrada desligada não conta).
  - ⚠️ **Se você desfizer esta atualização**, o recorte por assistente deixa de valer até você
    atualizar de novo: todo assistente volta a enxergar todas as entradas da base, inclusive as
    que você tinha restringido. A busca continua funcionando normalmente para todo mundo. Nada
    é apagado: o recorte continua gravado e volta a valer assim que você atualizar de novo. A
    tela do Desfazer avisa isso antes do clique.

- **Testar o assistente antes de soltá-lo num cliente.** Em **Configurações → Assistente →
  Testar o assistente** você conversa com ele numa tela só sua: escreve como se fosse o cliente
  e lê a resposta que sairia, com a base de conhecimento valendo. Nada é enviado a ninguém.
  Quando há mais de um assistente, um seletor escolhe qual testar — e a escolha vale **só para
  o teste**, ela não muda quem responde nos seus números.

- **Assumir uma conversa e devolvê-la ao assistente.** Na caixa de entrada, escolher uma pessoa
  em **Assumir** faz o assistente parar de responder naquela conversa; o botão **Devolver ao
  assistente** o traz de volta, mesmo que o cliente tenha insistido em falar com alguém antes.
  A lista mostra quais conversas estão caladas e desde quando.
  - No canal por código de pareamento há um segundo caminho, sem clique nenhum: **responder o
    cliente pelo aplicativo do celular** cala o assistente naquela conversa por 30 minutos.
    Isso não existe no canal oficial da Meta, onde o aparelho sai do ar — lá o caminho é o
    **Assumir**.

- **Horário de atendimento.** Em *Configurações → Assistente* você diz em que dias e horários a
  sua empresa atende, em que fuso, e quais são os feriados. **Fora do horário o assistente
  continua respondendo** — o que muda é que ele passa a dizer a partir de quando alguém do time
  responde. Quem não configurar nada não vê diferença nenhuma.

- **O assistente registra o atendimento na ficha do cliente.** Quando aparece um fato novo — o
  que a pessoa pediu, um dado que ela informou, uma dúvida que ficou aberta —, ele guarda uma
  anotação curta na linha do tempo do contato, marcada como escrita pelo assistente. É no máximo
  uma por atendimento, e ela é interna: o cliente não a vê.

### Mudado

- **Agora é "espaço de trabalho" em toda parte — a palavra *workspace* saiu das telas.** O CRM
  usava os dois nomes para a mesma coisa: as telas mais novas já diziam *espaço de trabalho* e as
  mais antigas ainda diziam *workspace*, inclusive nas primeiras que você vê ao instalar (entrar,
  criar conta, criar o primeiro espaço). Dois nomes para a mesma coisa fazem quem está começando
  procurar a diferença que não existe. **Nada muda no que o CRM faz** — é o texto da tela.

- **Se você liga o CRM a outro sistema pelo webhook de saída, leia esta.** O aviso de **contato
  novo** (`lead_novo`) leva os campos `telefone` e `origem`. Todo contato que o CRM criava
  **sozinho, a partir de uma mensagem**, sempre teve telefone, e a origem sempre foi `whatsapp`.
  Ao ativar o canal do Instagram, o mesmo aviso passa a sair, **pela primeira vez**, com
  `telefone` **vazio** e com `origem` valendo **`instagram`** — a pessoa chegou por um canal que
  não tem telefone nenhum.
  - **Se você não usa o webhook de saída, ou não vai ativar o Instagram, nada muda para você.**
  - Do outro lado (n8n, Zapier, um sistema seu), um passo que mexa no telefone sem conferir se
    ele existe vai quebrar no dia em que você ativar o canal — e vai quebrar no seu fluxo, não
    no CRM. Confira esse passo **antes** de ativar.

- **"Plugar IA" agora se chama "Integração por API".** Em Configurações, ele fica ao lado de
  **Assistente** e os dois pareciam a mesma coisa: quem queria ligar o assistente clicava no
  primeiro, gerava uma credencial que não liga assistente nenhum, e achava que tinha ligado. **O
  que o cartão faz não mudou** — ele continua sendo onde você gera a credencial e o endereço
  para outro sistema agir neste CRM.

- **A primeira subida depois desta atualização pode demorar mais que o normal.** O CRM prepara a
  tabela de contatos para as conversas, e numa base com muitos contatos essa preparação leva um
  tempo; enquanto ela roda, salvar ou importar contato pode ficar esperando. Não há nada a
  fazer, e nada é perdido — mas, se a sua base é grande, prefira atualizar num horário de baixo
  movimento.

- **O servidor ficou mais leve para quem não usa o assistente.** O relógio interno do CRM — o
  que dispara lembretes, avisos e envios — carregava junto o motor do assistente, mesmo em
  instalações que nunca o ligaram. Agora ele só é carregado quando há uma conversa para
  responder: cerca de **3,7 MB a menos** na memória do servidor. Nada muda no que o produto faz,
  nem para quem usa o assistente.

### Corrigido

- **Trocar o tema no Painel não mudava nada na tela.** Quem clicava em *Claro* ou *Escuro* pelo
  menu da conta **a partir do Painel** via a tela continuar igual — a preferência era gravada,
  mas só aparecia ao mudar de tela ou recarregar. O reflexo natural era clicar de novo, achando
  que o primeiro clique não pegou. Só o Painel tinha esse problema; nas outras telas a troca
  sempre funcionou. Agora ela vale na hora, em qualquer tela.

- **Criar, renomear e excluir etapa de funil não aparecia na tela.** Em *Configurações → Funis*,
  as três ações gravavam certo e a lista continuava mostrando as etapas de antes. Isso é pior do
  que parece: quem clicava em **Adicionar etapa** e não via nada clicava de novo — e aí sim
  ficava com **duas etapas iguais**; quem clicava em **Excluir** e via a etapa continuar ali
  clicava de novo numa etapa que já tinha sido apagada. Arrastar para reordenar nunca foi
  afetado. Agora as três aparecem imediatamente.

- **O arrastar-e-soltar falava inglês para quem usa leitor de tela.** No quadro de negócios e no
  editor de etapas, o aviso lido em voz alta era o texto padrão da biblioteca — em inglês, e
  identificando o cartão por um código interno em vez do nome. Agora ele é em português e diz o
  nome: *"Você pegou Renovação anual — Horizonte"*, *"…está sobre Proposta"*, *"Arraste
  cancelado. …continua onde estava"*. Isso vale também para quem arrasta **pelo teclado**
  (espaço pega, setas movem, espaço solta, Esc cancela).

- **A origem sumia da ficha do contato que chegou por um canal.** Ao abrir para editar um
  contato que entrou pelo WhatsApp, o campo **Origem** aparecia em branco — o valor estava
  gravado, mas não era uma das opções da lista, então o navegador não tinha o que mostrar. Quem
  editava lia "sem origem", escolhia uma à mão, e a informação real de por onde aquela pessoa
  chegou era substituída por um palpite. Agora ela aparece no campo, **travada**: de onde o
  cliente veio é um fato, e não algo para marcar à mão.

- **A tela de erro da pasta `custom/` estava ilegível no tema escuro.** Quando uma tela sua em
  `custom/paginas/` falhava, o CRM mostrava o detalhe do erro em cinza sobre cinza — praticamente
  invisível no tema que vem ligado por padrão. No tema claro ele sempre se leu bem, e foi por
  isso que passou tanto tempo assim.

- **Um botão do editor de etapas do funil aparecia com a cara do navegador.** Em
  *Configurações → Funis*, o botão de salvar a etapa era o único da tela sem o desenho do
  produto: fonte, borda e cor eram as do sistema operacional, ao lado de botões desenhados.

- **O guia de instalação ensinava, para o canal oficial, um jeito de calar o assistente que não
  existe lá.** A instrução "responda o cliente pelo aplicativo do celular" só vale no número por
  código de pareamento; no oficial o aparelho sai do ar, então não há aplicativo de onde
  responder. O guia agora aponta o **Assumir** da caixa de entrada, que funciona nos dois tipos.

---

## v0.7.2 — as telas param de prometer o que o CRM não faz

**A tela de Pessoas dizia que dono "remove gente deste espaço".** Não remove — isso não existe
no produto, em versão nenhuma. O que dono faz é convidar e cancelar um convite que ainda não
foi usado. O texto agora diz isso, e diz também que tirar deste espaço quem já entrou ainda não
dá para fazer por ali.

**Três mensagens diziam "dono de um espaço de trabalho" onde o certo é "dono deste servidor".**
Licença, atualização e o repositório do GitHub são do servidor inteiro, não de um espaço de
trabalho — quem responde por eles é uma pessoa só, a que instalou. Quem lia a mensagem antiga
sendo dono do próprio espaço concluía, com razão, que era um defeito.

**A tela de entrada oferecia "Criar workspace" mesmo com o cadastro fechado** — e ele nasce
fechado. A pessoa preenchia o formulário inteiro para só então ler que não podia. Agora o link
só aparece quando o cadastro está de fato aberto. **Convite continua funcionando com o cadastro
fechado**: quem foi convidado entra pelo link dele e nunca passou por essa tela.

**O passo a passo de instalação mudou de lugar.** Ele agora vive no guia do CRM, dentro da
Central de Ajuda, com print de cada etapa — e é lá que ele passa a ser atualizado. O
`docs/DEPLOY.md` que vem junto com o código continua completo, para instalar sem depender do
site.

**Criar espaço de trabalho ficou mais rigoroso.** Na tela nada muda: mesmo formulário, mesmo
botão, mesmo resultado. A diferença é interna — quem decide de quem é o espaço de trabalho
que está nascendo passou a ser o servidor, em vez de essa informação vir de fora junto com o
pedido. Espaços de trabalho que já existem seguem exatamente como estão.

**Não há nada a fazer da sua parte**, nem ao atualizar nem depois. E se você precisar
**desfazer** esta atualização, ela volta inteira: o Desfazer devolve o código, e esta versão
não deixa nada no banco que a versão anterior não saiba usar.

**Nome de espaço de trabalho em branco passou a ser recusado** também pelo lado do banco — a
tela já recusava.

---

## v0.7.1 — a atualização em 1 clique volta a terminar

**Se você clicou em Atualizar e a versão instalada não mudava, era isto.** O pacote que o
CRM baixava vinha com um defeito de empacotamento nosso: o envio para o seu GitHub
funcionava, mas o servidor falhava ao reconstruir — e é a reconstrução que troca a versão.
Por isso a tela dizia que tinha dado certo enquanto nada acontecia.

**Já está corrigido, e não é preciso esperar release nenhuma para isso**: a correção é no
pacote, então **basta clicar em Atualizar de novo**. O clique anterior deixou no seu
repositório a versão com o defeito, então repetir não é redundância — é o passo que troca o
conteúdo.

⚠️ **Se você está numa versão anterior à v0.3.5**, ainda falta um passo manual, uma vez só:
depois de clicar em Atualizar, abra o EasyPanel, entre no serviço do seu CRM e clique em
**Deploy**. Aquelas versões não sabiam avisar o servidor sozinhas — e, pior, a tela afirmava
*"o servidor está reconstruindo"* mesmo sem ter avisado ninguém. Da v0.3.5 em diante o CRM
faz isso por você.

**Se aparecer "encontrei N arquivos diferentes do original" com um número alto, pode
ignorar.** É consequência do mesmo travamento: o seu repositório recebeu a versão nova e o
servidor continuou na antiga. Nada foi perdido, nada foi sobrescrito, e o número volta ao
normal assim que a reconstrução terminar.

**A pasta `custom/` pode ser apagada por inteiro sem derrubar o build.** Quem removeu a
pasta em vez de deixá-la vazia via o servidor falhar apontando para um arquivo nosso que não
havia como adivinhar que precisava criar.

---

## v0.7.0 — o CRM ficou escuro (e você escolhe)

**A primeira coisa que você vai notar:** ao atualizar, o CRM **abre no escuro**. O claro
continua ali, a um clique — o botão está no menu da sua conta, no canto de baixo à esquerda.

A escolha é **sua, não do servidor**: cada pessoa da equipe decide a dela, e ela vale também
na tela de entrada, antes mesmo de você digitar a senha.

**A aparência foi refeita.** Cada bloco virou um painel com contorno e leve elevação, o menu
lateral passou a flutuar, e o produto trocou de fonte. Não é a mesma tela pintada de outra
cor: é o desenho inteiro.

**Todo negócio agora tem dono.** Dá para ver de quem é o negócio direto no cartão do quadro,
atribuir e passar para outra pessoa no detalhe, e filtrar o quadro por **Meus** × **Todos**.
⚠️ **Muda um comportamento:** negócio criado a partir desta versão nasce com **você** como
responsável — dá para trocar na hora, e os negócios que já existem continuam sem dono até
alguém atribuir.

**A tela de Configurações virou três abas** — *Espaço de trabalho*, *Pessoas* e *Servidor*.
Ela tinha virado uma página de rolagem longa, e a divisão segue o que cada seção já dizia:
o que vale para este espaço e o que vale para o servidor inteiro.

**Teclado e leitor de tela.** Os menus e seletores fecham com Esc e devolvem o foco para onde
você estava, e as mensagens de erro dos formulários passaram a ser anunciadas junto do campo
— antes elas existiam só para quem enxerga a tela.

**🔴 Convidar alguém volta a funcionar — e antes não funcionava.** Num servidor com cadastro
fechado (que é como ele vem), quem recebia um link de convite preenchia o formulário e lia
*"Cadastro fechado neste servidor. Peça um convite ao administrador"* — com o convite na mão.
Agora **o convite é a autorização**: o link válido entra mesmo com o cadastro fechado.
⚠️ **Muda uma coisa:** quem entra por convite passa a entrar **direto no seu espaço de
trabalho**, e não cria um próprio — por isso a tela nem pede mais o nome de um. Se alguém da
sua equipe já tinha criado um espaço vazio tentando aceitar um convite, ele continua lá; dá
para apagá-lo em *Configurações*.

**Correções que você talvez tenha notado:**

- as curvinhas dos indicadores do Painel chegavam **cortadas ao meio**, com um pedaço solto
  perto da ponta;
- um indicador sem variação no período desenhava uma linha reta que parecia risco de layout —
  agora ele diz que não houve variação;
- se você configurou uma cor de marca, o menu lateral ainda mostrava a cor original em dois
  lugares;
- **um link de convite vencido ou digitado errado não avisava nada:** quem clicava caía no
  cadastro comum, criava a conta e ia parar num espaço de trabalho novo, sozinho — e de quem
  convidou ninguém aparecia. Agora a tela diz que o convite não vale mais e pede um novo;
- os três pontinhos do cartão do quadro e o nome do funil em *Configurações → Funis* tinham
  área de clique menor que o mínimo, e erravam o alvo com o dedo;
- **planilha salva pelo Excel em português entrava com os acentos quebrados.** O "Salvar como
  → CSV (separado por vírgulas)" grava num formato antigo, e a importação lia tudo como se
  fosse o formato novo: todo *ã*, *ç*, *é* e travessão virava lixo, sem erro e sem aviso.
  Agora o arquivo é lido no formato que ele de fato tem. **Vale só para importações novas** —
  o que já entrou torto continua torto, e o caminho é reimportar;
- **marcar um negócio como ganho podia falhar sem dizer por quê:** o cartão sumia, voltava, e
  a tela só dizia "não foi possível". O motivo real é que a etapa tem campo obrigatório em
  branco — e agora ela diz qual. (Com *perdido* nunca aconteceu, porque perder não passa por
  essa checagem.);
- **com dois ou mais funis, o "← Negócios" voltava sempre para o funil padrão** — quem estava
  noutro funil voltava para o quadro errado e achava que os cartões tinham sumido;
- **um aviso de falha na atualização ficava na tela para sempre**, inclusive depois de o
  servidor já estar em dia. Agora ele some quando o servidor reinicia; o erro da tentativa que
  você acabou de fazer continua aparecendo, que é quando ele serve para alguma coisa;
- **o download da atualização desistia no primeiro tropeço.** Uma oscilação de rede ou uma
  recusa temporária do servidor de atualizações bastava para falhar, e a mensagem convidava a
  clicar de novo na hora — que é justamente o que faz o servidor recusar outra vez. Agora ele
  tenta de novo sozinho, esperando entre uma tentativa e outra, e quando a recusa é por excesso
  de tentativas a tela pede para **esperar alguns minutos**. Chave de licença inválida e
  "ainda não há versão publicada" continuam respondendo na hora — repetir não mudaria nada;
- várias combinações de cor de texto ficaram mais legíveis, nos dois temas.

**Se você usa cor de marca própria:** ela continua valendo, e agora o CRM deriva dela **duas**
paletas — uma por tema —, cada uma medida contra o fundo do seu tema. Nada para reconfigurar.

### Sobre os caminhos que as versões antigas citam

As seções abaixo mandam ir em **Configurações → Marca**, **→ Atualizações** e **→ Licença**.
Aquilo era verdade quando foi escrito e continua registrado como estava — mas, desta versão em
diante, os três moram na aba **Servidor**: **Configurações → Servidor → Marca**,
**→ Servidor → Atualizações** e **→ Servidor → Licença**. O mesmo vale para
**Configurações → Equipe**, que hoje é **Configurações → Pessoas**.

---

## v0.6.0 — a pasta `custom/` agora aceita telas, blocos e endereços seus

Até aqui, a única coisa que a sua pasta `custom/` aceitava era migration de banco. Quem
precisava de uma tela própria, de um bloco a mais numa tela do CRM ou de um endereço para
receber dados de outro sistema tinha que editar arquivo do produto — e perder a alteração na
atualização seguinte. Esta versão abre quatro lugares onde o seu código fica, e **a
atualização continua sem encostar neles**.

### Telas suas

Uma pasta em `custom/paginas/` vira um endereço no CRM:

```
custom/paginas/financeiro/pagina.tsx   →   /x/financeiro
```

A tela nasce dentro do CRM logado — com o menu lateral, a sessão e o espaço de trabalho ativo
já resolvidos. Dá para usar os mesmos componentes visuais do produto, então ela não destoa.
Para o item aparecer no menu, basta uma linha em `custom/menu.ts`.

### Blocos dentro das telas do CRM

Quatro pontos de encaixe (coluna da direita do negócio, pé das telas de contato e de empresa,
topo do painel). Um arquivo em `custom/slots/` com o nome do ponto e o bloco aparece ali —
sem editar a tela do produto.

### Endereços seus na API

Um arquivo em `custom/api/` vira `/api/custom/<nome>`. Serve para receber webhook de um ERP,
de um formulário, do que for.

### Tarefas que rodam sozinhas

Um arquivo em `custom/tarefas/` roda de tempos em tempos, sem ninguém abrir o CRM:

```ts
// custom/tarefas/sincronizar.ts
export const cada = '15m'
export default async function () { /* ... */ }
```

Serve para sincronizar com outro sistema, mandar um resumo diário, ou deixar um agente de IA
trabalhando. O mínimo é de 1 minuto; sem `cada`, roda de hora em hora.

### Reagir ao que acontece no CRM

Um arquivo em `custom/eventos/` roda quando o fato acontece — contato criado, negócio criado,
negócio mudou de etapa, negócio ganho, negócio perdido, contato apagado, negócio apagado:

```ts
// custom/eventos/deal-ganho.ts
export default async function ({ workspaceId, payload }) { /* ... */ }
```

Não é instantâneo: o CRM confere a fila a cada ~30 segundos. E você só recebe o que acontecer
**depois** de o arquivo existir — criar um gancho hoje não despeja o histórico de ontem.

### Bibliotecas do npm

Um `package.json` dentro da pasta `custom/` instala as dependências que o seu código usa, sem
mexer nas do produto.

### A garantia, e o limite dela

- **Erro em tempo de execução fica contido.** Se a sua tela quebrar ao rodar, ela mostra o
  erro e só ela: o restante do CRM, o boot e a atualização em 1 clique seguem funcionando.
  Erro de tipo também não incomoda ninguém — o seu código não passa pelo compilador do
  produto.
- ⚠️ **Mas erro de SINTAXE, ou um `import` de pacote que não existe, impede o servidor de
  reconstruir.** Nesse caso o CRM continua no ar normalmente, na versão que já estava; o que
  não acontece é a reconstrução — então uma atualização fica parada em "aguardando" até você
  corrigir o arquivo. A mensagem aparece no log de build do seu painel (EasyPanel →
  Implantações), apontando o arquivo e a linha.

**Confira antes de subir** e você nunca cai nisso — este comando lê só a sua pasta e acusa
tanto erro de digitação quanto de tipo:

```
pnpm exec tsc -p custom --noEmit
```

Cada uma das pastas novas (`custom/paginas/`, `custom/slots/`, `custom/api/`) chega com um
`LEIA-ME.md` dentro, com um exemplo copiável pronto — comece por eles.

⚠️ **Se você já usava a pasta `custom/` antes desta versão**, o `custom/LEIA-ME.md` da raiz
continuará dizendo que a zona tem só um ponto de extensão. Não é engano: a atualização nunca
sobrescreve arquivo dentro da sua pasta, nem os nossos que estão lá — é essa mesma regra que
protege o seu código. Os arquivos novos chegam normalmente; só o índice antigo permanece. Se
quiser a versão atual dele, apague o `custom/LEIA-ME.md` e ele volta na atualização seguinte.

**Nada muda para quem não usa a pasta `custom/`.**

---

## v0.5.0 — achar um negócio no quadro, anexar arquivo e duplicar

Esta versão saiu quase inteira de pedidos de vocês na comunidade.

### Busca no quadro de Negócios

Um campo no topo do quadro filtra por **título, contato ou empresa**, conforme você digita.
Não precisa acertar o acento: digitar `servico` acha "Serviço", `pecas` acha "Peças".

Palavras separadas por espaço são somadas: `acme joão` mostra só o negócio da Acme com o
João, mesmo que um esteja no título e o outro no nome do contato.

**Enquanto a busca está ligada, o quadro fica só para leitura** — não dá para arrastar cartão
nem adicionar. Isso é de propósito: com o quadro filtrado o CRM não enxerga os cartões
escondidos, e mover um deles bagunçaria a ordem dos que você não está vendo. A contagem no
topo mostra quantos apareceram de quantos, e o "✕" limpa a busca e devolve o quadro inteiro.

### Anexar arquivos ao negócio

Na tela do negócio há um bloco **Anexos**: PDF, PNG, JPEG ou WEBP, até 10 MB por arquivo.
Serve para a proposta, o contrato assinado, um print da conversa.

**Os arquivos são privados.** Eles não ficam num endereço público que alguém possa adivinhar:
cada download gera um link temporário, válido por poucos minutos, e só para quem está logado
no seu CRM. Ao excluir um anexo — ou o negócio inteiro — o arquivo é apagado de verdade do
armazenamento, não fica ocupando espaço.

### Duplicar um negócio

Nos **três pontinhos do cartão** e no topo da tela do negócio. A cópia nasce **aberta**, no
mesmo funil e etapa, logo abaixo do original, com valor, contato, empresa, previsão e campos
personalizados iguais.

O que a cópia **não** leva: o histórico (atividades e a passagem pelas etapas) e os anexos.
Ela é uma oportunidade nova para o mesmo cliente, não um relatório do que já aconteceu.
Duplicar um negócio perdido para tentar de novo funciona — a cópia vem aberta.

### Importação: escolher o funil e a etapa

Ao importar negócios, agora você diz **para qual funil e para qual etapa** eles vão. Antes
caíam sempre no funil padrão, na primeira etapa — quem trabalha com mais de um funil tinha
que arrastar cartão por cartão depois.

**Evitar duplicados agora aceita campos personalizados.** Se você tem um campo de CNPJ ou um
código interno, pode usá-lo como chave: o CRM compara o valor já padronizado, então
`12.345.678/0001-95` e `12345678000195` são reconhecidos como a mesma empresa e o cadastro é
**atualizado** em vez de duplicado.

**Correção junto:** colunas com acento no nome deixavam de ser reconhecidas. Uma planilha com
a coluna `Titulo` (sem acento) não casava com o campo "Título", a coluna era ignorada em
silêncio e os registros entravam sem aquele dado, com a importação dizendo que deu tudo certo.
Vale também para `Endereco`, `Telefone` e `Notas`. Se você importou e achou que faltou
informação, vale reimportar.

### Campos de seleção múltipla ficaram utilizáveis

Eles usavam a lista do navegador, em que marcar mais de uma opção exigia segurar **Ctrl** (e
no celular não funcionava). Pior: um clique sem Ctrl **apagava tudo que já estava marcado**.

Agora cada opção é um botão que você clica para marcar e clica de novo para desmarcar, com a
cor que você configurou aparecendo ao lado do nome.

### Para quem usa a integração por API

O CRM passou a avisar a integração quando um contato ou um negócio é **excluído**
(`lead_excluido` e `deal_excluido`). Antes a exclusão não era comunicada, e uma sincronização
seguinte podia recriar o registro apagado.

A fila de eventos também deixou de crescer em instalações que **não** usam integração: agora
só são registrados eventos quando há um destino configurado e ativo.

---

## v0.4.0 — o CRM com a sua marca, e o botão de excluir que faltava

### O CRM passa a ter a sua marca

Em **Configurações → Marca** você define **nome, logo, ícone da aba e cor principal**. Vale
para o servidor inteiro — inclusive a **tela de entrada**, que é a primeira coisa que a sua
equipe (ou o seu cliente, se você revende) vê.

**Isso fica salvo no banco, então sobrevive à atualização em um clique.** Se você trocou a
marca editando arquivos do produto, agora pode desfazer essa edição e usar a tela: o aviso de
divergência some junto.

Três coisas que valem saber:

- **Cores claras demais são recusadas na hora, com o motivo.** O texto dos botões é branco;
  sobre um fundo claro ele desaparece. A tela mostra o número medido e o mínimo, em vez de um
  "cor inválida" seco.
- **Cor muito escura também é tratada, e por dentro.** O menu lateral é escuro, então uma
  marca azul-marinho sumiria justamente no item onde você está navegando. Nesse caso o CRM
  clareia a cor **só dentro do menu** e mantém a sua exatamente como você escolheu no resto.
- **O logo aceita PNG, JPG e WEBP**, até 512 KB. Quadrado funciona melhor: o espaço é
  quadrado e a imagem é encaixada inteira, sem cortar.

### Agora dá para excluir contato, empresa, negócio e atividade

Faltava, e não havia contorno: um cadastro digitado errado ficava na sua base para sempre. O
botão fica no **pé da tela do registro**, longe do "Editar", e a confirmação diz **o que vai
junto, com número** antes de você clicar.

O que some e o que fica, porque isso surpreende:

- **Empresa:** os contatos e os negócios dela continuam existindo, só perdem o vínculo.
- **Contato:** os negócios continuam, mas **as atividades dele vão junto**.
- **Negócio:** as atividades e o histórico de etapas vão junto.

Atividade também pode ser excluída, direto da lista onde ela aparece. **Nada disso pode ser
desfeito** — a tela avisa antes.

---

## v0.3.5 — a atualização avisa o seu servidor, e a tela para de adivinhar

### O que muda

**O CRM passou a avisar o seu servidor sozinho.** Antes, atualizar enviava a versão nova pro
seu repositório do GitHub e parava por aí — quem reconstrói o servidor é o EasyPanel, e
ninguém o avisava. Você precisava abrir o painel e clicar em **Deploy** na mão, sem a tela
dizer isso.

**Como ligar, uma vez só:** no EasyPanel, abra o serviço do CRM → aba **Implantações** →
seção **Gatilho de Implantação**, copie a URL e cole em **Configurações → Atualizações**, no
campo *Gatilho de Implantação*. Daí em diante a atualização em um clique termina sozinha.

⚠️ Essa URL é secreta — quem a tiver consegue mandar o seu servidor reconstruir. Ela fica
criptografada no seu banco e a tela nunca mostra ela inteira de volta.

**E a tela parou de afirmar o que não sabia.** *"Enviado! Agora o servidor está
reconstruindo"* aparecia sempre, inclusive quando ninguém tinha avisado o servidor — então
era comum ler isso, fechar a página confiando, e a versão não mudar. Agora ela diz uma coisa
diferente em cada caso: que o servidor foi avisado e está reconstruindo; que o aviso não
passou e o motivo; ou que falta clicar em **Deploy** no painel. Nos três, ela avisa que o seu
código já está salvo no repositório e nada se perdeu.

**O "Desfazer" ganhou o mesmo aviso.** Ele voltava o código no repositório e o servidor podia
nunca reconstruir — justamente no momento em que você está tentando sair de uma versão
quebrada.

O guia de instalação (`docs/DEPLOY.md`) foi atualizado com o passo novo.

---

## v0.3.4 — a atualização em um clique agora termina

### 🔴 Leia isto se você já usa a atualização em um clique

**Falta um botão no seu EasyPanel, e sem ele a atualização nunca termina.** O CRM envia a
versão nova para o seu repositório do GitHub corretamente — mas quem reconstrói o servidor é o
EasyPanel, e ele só faz isso se o **Deploy Automático** estiver ligado. Ele **nasce
desligado**, e o guia de instalação não mandava ligar. O resultado é a pior combinação
possível: a tela diz "Enviado! Agora o servidor está reconstruindo", você fecha a página
confiando nela, e a versão simplesmente nunca muda.

**Como conferir em cinco segundos:** abra o seu app no EasyPanel. Se houver um botão escrito
**"Ativar Deploy Automático"**, ele está desligado — clique nele. Se disser "Desativar", já
está tudo certo.

**Você não perdeu nada.** O código novo já está no seu repositório desde a primeira tentativa.
Depois de ligar o Deploy Automático, clique em **Deploy** no EasyPanel uma vez; daí em diante
é automático. O guia de instalação (`docs/DEPLOY.md`) foi corrigido e agora traz esse passo.

Junto com ele, o guia ganhou outras correções de coisas que mudaram de lugar do lado do
Supabase e do EasyPanel: onde copiar o endereço do banco, onde ficam as chaves, como trocar a
senha do banco e qual token do GitHub o EasyPanel pede — que **não** é o mesmo da atualização
em um clique, e alcança bem mais coisa.

### Corrigido

- **Colar a chave da licença não destravava a tela de atualização.** A licença era aceita na
  hora e aparecia certinha — "Licenciada para você, atualizações até tal dia" —, mas o bloco
  logo abaixo continuava afirmando que "a atualização em um clique precisa de uma licença
  ativa", até você recarregar a página. Duas frases se contradizendo na mesma tela, e a
  conclusão natural era que a chave não tinha funcionado. Agora o bloco reage na hora.

- **O aviso "o servidor está reconstruindo" nunca ia embora.** Ele ficava na tela para sempre,
  inclusive depois de a atualização terminar — convivendo com "Você está na versão mais
  recente", que dizia o contrário. Agora ele some sozinho quando o servidor termina de subir a
  versão nova, e continua aparecendo enquanto a espera for real.

---

## v0.3.3 — entrar funciona, e o quadro mostra o funil que você escolheu

### Corrigido

- **Depois de criar a conta ou de entrar, a tela dava "This page couldn't load".** Você
  digitava e-mail e senha, e em vez do painel aparecia uma tela branca pedindo pra recarregar,
  com o endereço parado na página de login. Nada tinha falhado de verdade: a conta era criada
  e o login era feito — só o encaminhamento para o painel quebrava, e quem descobria o
  contorno (abrir o endereço do painel na mão) conseguia entrar normalmente.

  Agora o login e o cadastro levam direto ao painel.

- **Com mais de um funil, trocar de funil não trocava o quadro.** O nome do funil mudava no
  seletor e o endereço mudava junto, mas as colunas continuavam sendo as do funil anterior até
  você recarregar a página. Isso é pior do que parece: não aparecia erro nenhum, então dava
  pra trabalhar um tempo achando que estava olhando um funil quando estava olhando outro.

  Obrigado ao comprador que reportou isso já com o diagnóstico pronto.

### Novo

- **Botão de mostrar a senha** nas telas de entrar e de criar conta. Ele ajuda mais no
  cadastro: é ali que você cola a chave do primeiro acesso e escolhe a senha do dono, e antes
  não havia como conferir o que tinha sido digitado sem apagar tudo e começar de novo.

### Para quem personaliza o CRM com ajuda de uma IA

- **O guia `AGENTS.md` dizia que nome, logo e cores se configuram em Configurações. Não se
  configuram** — essa tela ainda não existe, e a instrução errada levava o agente de código a
  editar arquivos do produto, que é justamente o que ele não deve fazer: a edição vira aviso
  de divergência e sai da branch principal na atualização seguinte. O guia agora diz a verdade
  e manda parar e avisar. A tela de marca é um pedido conhecido e está no mapa.

---

## v0.3.2 — o CRM avisa quando sai versão nova

### Novo

- **Um ponto ao lado de "Configurações" quando existe uma versão nova.** Antes, a única forma
  de descobrir que saiu atualização era abrir Configurações por conta própria — e ninguém abre
  Configurações sem motivo. Agora o aviso aparece na barra lateral, de qualquer tela.

  Ele aparece **só para quem é dono desta instalação**, porque é quem tem o botão de atualizar.
  Os demais membros não veem nada — não é informação que eles possam usar.

  Se você prefere menos movimento na tela, o ponto respeita a configuração de **"reduzir
  animações"** do seu sistema: ele continua visível, sem piscar.

### Corrigido

- **A tela de Configurações podia oferecer a atualização em um clique logo abaixo de dizer que
  não havia licença.** Acontecia depois de usar "Remover chave": a chave saía, mas o CRM
  continuava contando com a última resposta do nosso servidor. Agora as duas partes da tela
  concordam — sem chave, não há atualização em um clique, e é o que as duas dizem.

---

## v0.3.1 — ajustes na confirmação da licença

### Corrigido

- **A tela de licença agora só libera o acesso com uma confirmação positiva** do nosso
  servidor — antes ela se contentava com menos.

  **Se a sua licença está em dia, nada muda para você**: nem a tela, nem o botão
  **Verificar agora**, nem o campo de colar uma chave nova. Quem nunca colou uma chave segue
  sem ser afetado por nada disso, como sempre.

  Se você foi parado nessa tela e acha que é engano, fale com o suporte com ela aberta.

---

## v0.3.0 — o CRM pode pedir para confirmar a licença antes de continuar

### ⚠️ Leia isto primeiro: uma mudança no acesso

Até a versão anterior, **nada** no CRM parava por causa da licença — era o que este arquivo e
o `README.md` diziam, e era verdade. **A partir desta versão existem duas situações em que o
CRM para na frente de todo mundo** e pede que a licença seja confirmada antes de continuar:

1. **Compra reembolsada dentro do prazo de garantia.**
2. **Instalação recente que passou alguns dias sem conseguir confirmar a licença** com o nosso
   servidor — servidor sem internet, por exemplo.

**Isso não é um plano pago nem uma funcionalidade a menos.** Continua não existindo tela,
campo ou relatório que a licença destranque: quem nunca colou uma chave não é afetado por
nada disso, e quem tem licença em dia nunca vê essa tela. O caso 2 **se resolve sozinho**
assim que a confirmação chega — e o CRM tenta sozinho o tempo todo.

**Quem instalar agora não precisa fazer nada.** Só um aviso para quem gosta de enxugar
configuração: existe uma variável chamada `HEARTBEAT_ENABLED` que desliga o relógio interno do
CRM. **Não a crie.** Desligado, o relógio para de confirmar a licença, e é exatamente aí que o
caso 2 acontece. O guia de instalação explica em "não crie esta variável", no
[`docs/DEPLOY.md`](docs/DEPLOY.md).

### A tela de bloqueio, e como sair dela

Quando um dos dois casos acontece, o CRM leva todo mundo para uma tela única que diz o que
houve e o que fazer. O que dá para fazer nela depende de quem você é:

- **O dono da instalação** vê o motivo, um botão **Verificar agora** (que resolve o caso 2 na
  hora, se o servidor tiver internet) e um campo para colar uma **chave nova**, caso o suporte
  tenha emitido uma. Assim que destrava, o CRM volta ao normal sozinho — não precisa reiniciar
  nada.
- **Os demais membros** veem que o acesso está temporariamente indisponível e a orientação de
  avisar o dono do servidor. Eles **não veem o motivo**, e isso é de propósito: numa
  instalação que hospeda espaços de trabalho de clientes, o motivo é assunto comercial de
  quem contratou, não de quem usa.

Em qualquer um dos casos há um botão de **sair**, para desocupar o navegador e deixar outra
pessoa entrar. **Seus dados nunca são apagados** — eles estão no seu banco, intactos, e
voltam a aparecer assim que o acesso é liberado.

### Miudezas

- **A aba do navegador voltou a ter ícone.** O CRM aparecia como uma folha em branco na barra
  de abas, o que atrapalhava quem trabalha com muitas abas abertas.
- **A coluna lateral do detalhe some quando está vazia.** Em quem não criou campos próprios,
  ela ocupava um terço da tela sem mostrar nada.

### Sobre o que as versões antigas dizem

As seções da `v0.1.0` e da `v0.2.0` abaixo dizem que **nada** no CRM é bloqueado por licença.
Aquilo era verdade quando foi escrito e continua registrado como estava — mas a regra que vale
hoje é a desta seção.

---

## v0.2.0 — o CRM inteiro foi redesenhado

Todas as 23 telas mudaram de cara. Se você já usa o CRM, **vai estranhar no primeiro
minuto** — nada mudou de lugar no fluxo, mas quase tudo mudou de aparência.

### ⚠️ Uma mudança no seu dado, e ela aparece no funil

A etapa que o CRM criava chamada **"Negociacao"** (sem cedilha) passa a se chamar
**"Negociação"**. Era um erro nosso: o nome estava certo quando você criava um funil pela
tela, e errado quando o CRM criava o funil inicial — dá pra ver os dois em qualquer conta
que tenha os dois tipos de funil.

**Se você renomeou essa etapa**, nada acontece: só o texto exato que nós gravamos é
corrigido. E se preferir a grafia antiga, é renomear em Configurações → Funis.

### O que mudou na tela

- **O menu lateral ficou escuro.** Ele deixa de competir com o conteúdo e passa a emoldurar.
- **A página ficou branca e as caixas sumiram.** Onde havia um cartão cinza em volta de cada
  bloco, agora há título, um filete e espaço. Menos moldura, mais dado.
- **O quadro de negócios virou raia.** As colunas cinzas deram lugar a faixas com uma barra
  na cor da etapa, e o quadro agora ocupa a tela toda em vez de terminar no meio.
- **As telas de detalhe ganharam uma faixa de identidade no topo** (valor, previsão, contato,
  empresa) e o histórico deixou de ocupar a largura inteira, que é o que fazia cada linha ter
  duzentos pixels de texto e novecentos de branco.
- **A agenda passou a ser lida por horário**, com a hora numa coluna própria em vez de
  espremida embaixo do título.
- **Os relatórios ganharam a mesma cor do funil do painel.** As duas telas mostram o mesmo
  funil e discordavam na cor.
- **As telas de detalhe agora têm caminho de volta.** Quem entrava por um cartão do quadro só
  saía pelo menu lateral.

### Coisas que estavam quebradas e ninguém tinha reportado

- **Clicar nos três pontinhos de um cartão abria o negócio** em vez de abrir o menu.
- **Soltar um cartão abaixo da pilha não funcionava** — só valia soltar em cima de outro
  cartão, e sem nenhum aviso de que não deu.
- **O indicador "Parados" estava travado em 5.** Ele contava o tamanho da lista, não os
  negócios parados: com 30 travados, a tela dizia 5.
- **A variação da taxa de conversão aparecia como "20,0% pp"**, com dois símbolos.
- **A dica do campo de previsão saía com a mesma cor e peso do valor digitado**, parecendo
  conteúdo do campo.
- Alguns textos estavam sem acento (**"Ela esta no log"**, na tela de primeiro acesso).

### Continua valendo

Nada no CRM é bloqueado por licença — o produto inteiro funciona sem ela, hoje como antes.
E o caminho manual de atualização segue existindo, em "Atualizar pra uma versão nova" no
[`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## v0.1.0 — atualizar virou um clique

Primeira release com **identidade e atualização própria**. Até aqui o CRM não tinha número
de versão nem tag (dois deploys eram indistinguíveis, e o suporte não tinha como perguntar
"qual versão você está rodando"), e atualizar era substituir arquivo por arquivo na mão.

### Atualização em um clique

Em **Configurações → Atualizações**, quem tem licença ativa passa a atualizar clicando. O
CRM baixa a versão nova, envia pro **seu** repositório do GitHub e o servidor reconstrói
sozinho. A tela tem o passo a passo pra conectar o repositório uma vez só, com link direto
pra criar o token já na página certa.

Três coisas que a tela diz, e que valem saber antes do primeiro clique:

- **"Enviado" não é "atualizado".** Depois do envio o servidor ainda reconstrói, o que leva
  alguns minutos; a versão no rodapé só muda no fim.
- **Se você editou arquivos do CRM**, a tela avisa quantos e salva uma cópia num branch de
  backup **antes** de qualquer alteração. Nada é perdido em silêncio. A pasta `custom/` é
  sua e nunca é tocada.
- **"Desfazer" volta o código, não o banco.** Se a versão nova criou ou removeu campos, eles
  continuam como estão.

**O caminho manual continua valendo e não vai sumir** — está em "Atualizar pra uma versão
nova", no [`docs/DEPLOY.md`](docs/DEPLOY.md). Sem licença, ou com a janela de atualizações
vencida, você atualiza por ele — com o produto inteiro funcionando. Nada no CRM é bloqueado
por licença.

### Equipe

**Configurações → Equipe** mostra quem tem acesso ao espaço de trabalho e gera link de
convite. Antes, dar acesso a um colega exigia reabrir o cadastro por SQL — o que deixava
qualquer um que descobrisse o endereço criar conta. O link vale 7 dias, some depois de usado
e dá pra cancelar na mesma tela.

### Licença

**Configurações → Licença** mostra o estado da sua chave em português claro, distinguindo
"ainda não confirmei" de "cancelada" — e sempre dizendo quando o CRM continua funcionando
(que é quase sempre).

### Miudezas que evitam dor de cabeça

- **Versão visível** no rodapé do `/config`. É a primeira coisa que o suporte pergunta.
- **Boot mais seguro em banco reaproveitado.** Apontar o CRM pra um banco já usado por uma
  instalação anterior agora dá instrução clara no log em vez de erro cru — o passo a passo
  está em "Este banco já tem tabelas do CRM", no [`docs/DEPLOY.md`](docs/DEPLOY.md).
- **Só o dono do deploy** troca a licença e aperta o botão de atualizar — nem o dono de um
  espaço de trabalho convidado alcança, porque esse botão reconstrói o CRM de todos.
