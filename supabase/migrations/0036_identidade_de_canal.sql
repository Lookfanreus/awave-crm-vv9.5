-- 0036_identidade_de_canal.sql — o contato passa a poder ser reconhecido por um identificador
-- OPACO do canal, e nao so pelo telefone.
--
-- ⚠️ ADITIVA. Duas colunas novas e nulas, mais um indice: nenhuma linha muda, nenhuma coluna
-- some, nenhum dominio se estreita, e todo contato que ja existe continua valido com as duas
-- vazias. Migration que falha = container que NAO SOBE, em toda instalacao: o EasyPanel mantem
-- a versao anterior servindo e o comprador fica sem entender por que a atualizacao "nao pegou".
--
-- ⚠️ `contatos` JA TEM RLS desde a 0002, e policy e por TABELA, nao por coluna — coluna nova
-- nao pede policy nova. Quem isola um espaco de trabalho do outro na ESCRITA continua sendo o
-- filtro por `workspace_id` no codigo, porque toda escrita de contato sai pelo service-role, que
-- nao avalia policy nenhuma.
--
-- 🔴 POR QUE NAO REUSAR `contatos.chave_externa`: ela e o espaco de nomes do sistema externo DO
-- COMPRADOR — a API v1 e a importacao de CSV deduplicam por ela. Um identificador de canal
-- gravado ali passaria a disputar a mesma chave que o ERP dele usa, e a deduplicacao casaria
-- duas coisas que nao tem nada a ver uma com a outra. (A unicidade dela ja e por espaco de
-- trabalho desde a 0004 — nao ha divida ali; o motivo de nao reusa-la e outro, e e este.)

-- ── as duas colunas ────────────────────────────────────────────────────────────────────

-- O identificador da pessoa DENTRO daquele canal, exatamente como o provider o entrega: um id
-- que nao e telefone e nao disca. Nulo em todo canal telefonico — que e o estado de todos os
-- canais de hoje, entao esta coluna nasce vazia em toda instalacao.
--
-- 🔴 ELA E DELIBERADAMENTE SEPARADA DE `telefone`, e nao um segundo lugar para guardar a mesma
-- coisa. `telefone` alimenta o casamento por `telefone_sufixo` (0022), que compara numero com
-- numero e ja avisa, sobre o mesmo risco, que casar por ali funde duas pessoas diferentes num
-- registro so e que isso nao se desfaz. Um identificador opaco escrito em `telefone` entra
-- naquele casamento e produz exatamente esse dano.
alter table public.contatos
  add column if not exists identidade_externa text;

-- O ESPACO DE NOMES em que aquele identificador vale — a metade que e facil esquecer.
--
-- 🔴 UM ID OPACO SO E UNICO DENTRO DA CONTA QUE O EMITIU. Duas contas do mesmo provider, no
-- mesmo espaco de trabalho, podem emitir o MESMO id para pessoas diferentes: provider nenhum
-- promete unicidade entre contas. Sem esta coluna na chave, essas duas pessoas colidiriam e
-- virariam um registro so — o mesmo dano que a coluna irma existe para impedir, entrando pela
-- porta nova.
--
-- O valor e o id da CONTA (`canais.external_id`), nao o slug do provider e nao o id da linha do
-- canal: o slug juntaria duas contas num namespace so, e o id da linha orfanaria todos os
-- contatos no dia em que o canal fosse apagado e recriado.
alter table public.contatos
  add column if not exists identidade_canal text;

-- ── a chave ────────────────────────────────────────────────────────────────────────────
--
-- UNICO E PARCIAL. Unico porque e ele que faz a segunda mensagem da mesma pessoa achar o
-- contato que ja existe em vez de criar mais um; parcial porque a esmagadora maioria dos
-- contatos do comprador nao tem identidade de canal nenhuma, e indexar nulo so ocuparia espaco.
--
-- 🔴 `workspace_id` NA CHAVE, e na frente. Escrita de contato sai toda pelo service-role, que
-- nao avalia RLS: o que separa um espaco de trabalho do outro e o filtro do codigo, e uma chave
-- que ignora o espaco desfaz esse isolamento no banco. Sem ele, dois espacos do mesmo deploy
-- disputariam o mesmo id — o contato de um cliente impediria o do outro de nascer, e a mensagem
-- cairia numa conversa sem contato, sem nada explicando por que.
--
-- ⚠️ UNICO E SEGURO AQUI, ao contrario do indice de `telefone_sufixo` da 0022 — que precisou
-- nascer COMUM porque o comprador ja tinha telefones duplicados na tabela. As duas colunas acima
-- nascem vazias, entao nao existe uma linha sequer dentro do filtro parcial para colidir na hora
-- de criar o indice. `if not exists` porque o boot reaplica migration pendente, e uma segunda
-- passada nao pode falhar.
--
-- ⚠️ E ELE SO SEPARA O QUE ESTIVER COMPLETO: no Postgres nulo nunca conflita com nulo, entao uma
-- linha com `identidade_canal` vazia nao e deduplicada por este indice. Quem recusa gravar
-- identidade sem espaco de nomes e o codigo do despacho, antes do insert. O lado errado de errar
-- ali e criar contato repetido — nunca juntar dois, que e o que nao se desfaz.
create unique index if not exists contatos_identidade_canal_key
  on public.contatos (workspace_id, identidade_canal, identidade_externa)
  where identidade_externa is not null;

-- ── a coerencia das duas colunas ────────────────────────────────────────────────────────
--
-- O indice acima separa o que estiver COMPLETO; esta restricao garante que so exista o
-- completo. Sem ela, a regra "identidade sem espaco de nomes nao entra" vive so no codigo do
-- despacho, e uma segunda rota de escrita — uma importacao, uma correcao manual pelo SQL
-- Editor, um caminho futuro — a contorna sem nada avisar. Uma linha com `identidade_externa`
-- preenchida e `identidade_canal` vazia fica INVISIVEL para o indice parcial e para a busca de
-- contato: ela nunca casa com ninguem, e o mesmo cliente vira um contato novo a cada mensagem.
--
-- ⚠️ A JANELA PARA CRIAR ISTO E AGORA, e e por isso que ela entra junto com as colunas: as duas
-- nascem vazias neste mesmo arquivo, entao a validacao e trivial em qualquer banco. Depois que
-- a rota de identidade comecar a gravar, uma restricao nova passa a poder reprovar dado que ja
-- esta la — e migration que falha e container que NAO SOBE, em toda instalacao.
--
-- O sentido e um so de proposito: `identidade_canal` sozinha e permitida (nao afirma nada sobre
-- pessoa nenhuma); `identidade_externa` sozinha, nao.
-- 🔴 GUARDADA, porque o Postgres nao tem `add constraint if not exists` — era a UNICA
-- instrucao nao-idempotente deste arquivo, num arquivo que promete o contrario vinte linhas
-- acima ("uma segunda passada nao pode falhar").
--
-- Pelo caminho normal ela nao seria reexecutada: o aplicador envolve o arquivo E o registro da
-- versao numa transacao so, entao constraint criada implica versao registrada. O estado que
-- reabre isso e o que o historico deste repositorio ja viveu — migration aplicada a mao pelo
-- editor de SQL com o registro incompleto. O pre-voo recusa o boot quando a tabela de registro
-- NAO EXISTE, mas nao quando ela existe faltando esta linha: ai o boot reexecuta, sai `42710`,
-- e o container nao sobe. A guarda custa cinco linhas; o diagnostico custa uma manha.
--
-- 🔴 `NOT VALID`, E O QUE ELE COMPRA E A VARREDURA — NAO A TRAVA. `add constraint` toma
-- `ACCESS EXCLUSIVE` em `contatos` de qualquer jeito; o que o `not valid` elimina e a
-- verificacao das linhas que JA EXISTEM, e sem varredura a trava dura o tempo de uma escrita
-- de catalogo em vez do tempo de ler a maior tabela do CRM. Isto importa porque roda no boot
-- do container NOVO enquanto o ANTIGO ainda atende o comprador: durante a varredura toda
-- leitura e escrita de contato dele bloqueia, e se alguma sessao ja segurar trava conflitante
-- o `lock_timeout` aborta a migration — o container novo sai com 1 e a atualizacao "nao pega".
-- Numa base com centenas de milhares de contatos essa e a diferenca entre um piscar e uma
-- parada.
--
-- 🔴 E NAO FALTA UM `validate constraint` DEPOIS, NESTE CASO ESPECIFICO: as duas colunas que o
-- predicado le NASCEM NESTE MESMO ARQUIVO, na secao "as duas colunas" logo acima, por
-- `add column if not exists` e sem default. Toda linha pre-existente tem as duas nulas, e
-- `nulo is null` satisfaz o predicado — nao existe uma linha sequer que a validacao pudesse
-- reprovar. E `NOT VALID` nao afrouxa NADA para o dado novo: a restricao vale para todo insert
-- e todo update desde o instante em que ela existe, que e a metade que este arquivo precisa.
-- Fica devendo so a marca `convalidated` no catalogo, que quem usa e o planejador (exclusao
-- por restricao) — e aqui nao ha particao nem heranca para planejar.
--
-- ⚠️ No caso torto ela ainda e a mais segura: se este arquivo tiver sido aplicado a mao e a
-- coluna ja tiver dado, uma restricao VALIDADA poderia reprovar uma linha existente e derrubar
-- o boot em toda instalacao. Esta nao pode.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'contatos_identidade_coerente'
       and conrelid = 'public.contatos'::regclass
  ) then
    alter table public.contatos
      add constraint contatos_identidade_coerente
      check (identidade_externa is null or identidade_canal is not null) not valid;
  end if;
end $$;
