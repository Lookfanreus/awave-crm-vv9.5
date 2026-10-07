-- 0053_ordem_das_bolhas.sql — a resposta cortada em bolhas para de chegar comecando pelo meio.
--
-- ⚠️ ADITIVA: uma coluna nova (sem `not null`, sem default, sem backfill), uma restricao
-- `not valid` guardada por catalogo, e o corpo de UMA funcao substituido por `create or replace`
-- de assinatura IDENTICA. Nenhuma coluna sai, nenhum dominio estreita, nenhum indice muda e
-- nenhuma chamada existente deixa de resolver. Migration que falha e container que NAO SOBE, em
-- toda instalacao.
--
-- ── O DEFEITO ───────────────────────────────────────────────────────────────────────────
--
-- 🔴 UMA RESPOSTA VIRA ATE TRES BOLHAS, E O DRENO NAO SABIA QUE AS TRES SAO A MESMA RESPOSTA.
-- `enviarMensagem` (src/server/canais/envio.ts) corta o texto em pedacos, e cada pedaco vira uma
-- LINHA propria de `mensagens`, com contador de tentativas proprio. DENTRO daquela chamada a
-- ordem e respeitada: quando um pedaco falha, os seguintes nascem `pendente` com o MESMO relogio
-- de retentativa do que falhou, e nao saem na frente dele.
--
-- A garantia morria ali. O dreno reserva um LOTE e processa linha a linha, sem nenhum vinculo
-- entre elas — e as tres ficam elegiveis no MESMO instante, justamente porque o pedaco segurado
-- copiou a `proxima_tentativa` do que falhou. Se a bolha 1 falha de novo, a 2 e a 3 saem no MESMO
-- passe: o cliente recebe a resposta comecando pelo meio, e enquanto a 1 nao chegar ele fica com
-- uma resposta cuja primeira frase nao existe. Nao e preciso provider fora do ar por vinte
-- minutos — basta uma falha na primeira bolha, o que e o caso comum de instabilidade.
--
-- ── O CONSERTO ──────────────────────────────────────────────────────────────────────────
--
-- Cada bolha aponta para a ANTERIOR (`predecessora_id`), e a reserva so serve a linha cuja
-- predecessora JA TEVE DESFECHO.
--
-- 🔴 "AINDA TEM DESFECHO POR VIR" E, PALAVRA POR PALAVRA, O PREDICADO DESTA MESMA FILA:
-- `status = 'pendente' and direcao = 'saida' and desistido_em is null`. A repeticao nao e
-- estilo — e dela que sai a prova de que a fila NAO TRAVA: a bolha seguinte espera exatamente
-- enquanto a anterior ESTA NA FILA, e nao existe estado em que uma linha fique nesta fila para
-- sempre. Escrever aqui qualquer predicado mais estreito (por exemplo `status <> 'enviada'`)
-- inventaria um bloqueio permanente numa fila que roda a cada ~30 segundos em toda instalacao.
--
-- ── TODO ESTADO EM QUE A PREDECESSORA PODE PARAR, E COMO CADA UM DESTRAVA ────────────────
--
--   1. `enviada` / `entregue` / `lida` — saiu da fila no desfecho de sucesso. Destrava no tick
--      seguinte. E o caso normal.
--   2. `falhou` + `desistido_em` (desistencia por veredito terminal do provider, ou por esgotar
--      as cinco tentativas do backoff) — sai da fila pelas DUAS metades do predicado ao mesmo
--      tempo. Destrava. E a decisao escrita mais abaixo.
--   3. `pendente` em retentativa — CONTINUA segurando, e e o unico estado que segura. A escada
--      e limitada por construcao (`TETO_TENTATIVAS` = 5, espera com teto de 30 min), entao ela
--      termina sempre no estado 2 ou no 1. Segurar aqui e o objetivo da migration, nao um
--      efeito colateral: e exatamente enquanto a bolha 1 ainda pode chegar que a 2 nao pode sair.
--   4. Orfa de processo morto — a linha ficou `pendente` com `enviando_desde` velho porque o
--      container caiu no meio do POST. Ela e re-reservada quando a janela de reserva vence
--      (15 min) e o dreno a marca `falhou` + `desistido_em` sem reenviar. Destrava, com teto de
--      tempo. Note que ela SO chega a este estado depois de a predecessora DELA ter desfecho,
--      entao a cadeia nao se enrosca.
--   5. Linha apagada — a mao, pelo expurgo de historico, ou pelo `on delete cascade` da conversa.
--      O `not exists` procura a linha por chave primaria e NAO A ACHA, e nao achar e verdadeiro:
--      destrava. E o mesmo caminho que trata `predecessora_id` NULO (ver logo abaixo).
--
-- 🔴 O UNICO BLOQUEIO PERMANENTE CONCEBIVEL E UM CICLO, e ele nao nasce do produto: a unica
-- escritora desta coluna aponta sempre para uma linha que ACABOU de ser inserida na mesma
-- chamada, o que e aciclico por construcao. O ciclo de tamanho 1 (a linha apontando para si
-- mesma) fica impossivel pela restricao logo abaixo; um ciclo de dois so nasce por edicao a mao
-- no banco, e se alguem o criar o desfecho e o mesmo de qualquer outro engano de edicao manual —
-- apagar ou dar desfecho a qualquer uma das duas linhas destrava as duas.
--
-- ── A DECISAO SOBRE A BOLHA 1 QUE MORRE DE VEZ ──────────────────────────────────────────
--
-- 🔴 AS IRMAS SAO SOLTAS, NAO DESCARTADAS E NAO SEGURADAS PARA SEMPRE. As tres saidas custam, e
-- a escolha e por qual custo o cliente e quem instalou pagam:
--   · SEGURAR para sempre trava a fila daquela conversa — e o pior dos tres desfechos, porque
--     nao e um erro visivel, e uma conversa que nunca mais anda;
--   · DESCARTAR as irmas entrega SILENCIO. A doutrina desta casa, escrita no teto de bolhas do
--     `saida.ts`, e "truncar, e nao descartar: o cliente ja esta esperando" — e silencio total o
--     cliente le como abandono, enquanto uma resposta que comeca no meio ele consegue responder
--     pedindo de novo. Os custos nao sao simetricos;
--   · SOLTAR entrega a resposta comecando pelo meio, que e o defeito desta migration. Mas so
--     depois de a bolha 1 ter esgotado a escada de retentativas inteira: o que era o caso COMUM
--     (uma falha qualquer na primeira bolha) passa a ser o caso RARO (o provider recusou aquele
--     pedaco de forma terminal, ou recusou cinco vezes seguidas).
--
-- ⚠️ E O QUE QUEM INSTALOU VE, que e a outra metade da escolha: a bolha morta NAO some. Ela fica
-- na thread, no lugar dela (a thread ordena por `origem_em`, e ela nasceu antes das irmas), com o
-- texto inteiro legivel e com o desfecho `falhou` ao lado — a caixa de entrada mostra o status de
-- toda mensagem de saida, nao so das que deram certo. Quem le a conversa ve exatamente onde esta
-- o furo e o que deveria ter sido dito ali. A escolha e essa: preferimos um furo VISIVEL no lugar
-- certo a uma conversa muda.
--
-- ── DUAS ARMADILHAS DE SQL QUE ESTE CORPO EVITA, e as duas sao MUDAS ─────────────────────
--
-- 🔴 1. A CORRELACAO E QUALIFICADA (`mensagens.predecessora_id`), E ISSO NAO E ESTILO. Dentro da
-- subconsulta o escopo mais interno vence: um `predecessora_id` NU ali dentro resolveria para
-- `p.predecessora_id`, a condicao viraria "a predecessora aponta para si mesma", ela seria sempre
-- falsa, o `not exists` seria sempre verdadeiro e a ordem das bolhas ficaria INERTE — sem erro,
-- sem log, e com todo arquivo lido sozinho parecendo certo. A relacao do meio nao tem apelido de
-- proposito, para o predicado da fila continuar sendo texto identico ao da `0022` e ao do indice
-- parcial da `0049`; quem der um apelido a ela tem de qualificar por esse apelido, e o SQL para
-- de resolver na PRIMEIRA CHAMADA, nunca no boot (ver a armadilha 2).
--
-- 🔴 2. ERRO SEMANTICO AQUI NAO APARECE NO BOOT. Este corpo e `language plpgsql`: o validador que
-- o `check_function_bodies` roda faz PARSE do SQL embutido, e nome de coluna que nao resolve e
-- analise semantica. A migration aplica limpa, o container SOBE, e o erro sai na PRIMEIRA
-- CHAMADA — que e `drenarFila`, e ela roda sob `.catch` no tick. O desfecho real e um
-- `console.warn` no log do container e a FILA DE SAIDA PARANDO CALADA em toda instalacao: ninguem
-- recebe resposta nenhuma, do assistente ou de gente. Quem mexer nesta forma confere contra um
-- Postgres antes, ou nao mexe.
--
-- ── O QUE NAO MUDA, E POR QUE ───────────────────────────────────────────────────────────
--
-- ⚠️ O INDICE PARCIAL DA FILA (`mensagens_fila_saida_idx`, `0049`) CONTINUA COBRINDO A CONSULTA.
-- Os tres conjuntos indexaveis (`status`, `direcao`, `desistido_em`) chegam aqui palavra por
-- palavra; o conjunto novo e mais um filtro sobre a linha JA LIDA, exatamente como o
-- `coalesce(proxima_tentativa, criado_em) <= now()` sempre foi. Nenhum dos dois cabe num
-- predicado de indice parcial pelo mesmo motivo: predicado de indice so aceita expressao
-- IMUTAVEL, e nem `now()` nem subconsulta sao.
--
-- ⚠️ E O CUSTO POR LINHA VARRIDA E UMA BUSCA POR CHAVE PRIMARIA, so para quem tem predecessora.
-- Com `predecessora_id` NULO — que e a esmagadora maioria das linhas, porque toda mensagem de uma
-- bolha so e primeira bolha — a comparacao `p.id = null` nao casa nada e o Postgres nem percorre
-- o indice. Isto e leitura da documentacao, nao medicao: nenhuma versao deste corpo foi submetida
-- a um Postgres.
--
-- ⚠️ NAO HA CHAVE ESTRANGEIRA, e a ausencia e decidida. Uma FK obrigaria um indice sobre
-- `predecessora_id` (senao cada exclusao de mensagem varre `mensagens` inteira procurando quem
-- aponta para ela), e `mensagens` e a tabela que mais cresce neste banco — seria um quinto indice
-- pago em toda gravacao para servir uma leitura que ninguem faz. O que a FK compraria — o
-- ponteiro pendurado depois de a predecessora ser apagada — o `not exists` ja trata pelo caso 5
-- acima, e trata do jeito certo: destravando.
--
-- ⚠️ E NAO HA `revoke`/`grant` AQUI. `create or replace` de assinatura IDENTICA preserva dono e
-- permissoes: as linhas da `0022` (que revogam de `public`, `anon` e `authenticated` e concedem
-- so a `service_role`) continuam sendo as autoritativas. Repeti-las nao acrescentaria nada;
-- troca-las por `drop function` + `create function` e que reabriria a porta, porque a criacao
-- reganharia o EXECUTE que o `alter default privileges` do Supabase concede a `authenticated` —
-- e esta funcao e `security definer` e devolve `setof public.mensagens`, ou seja a conversa de
-- TODOS os inquilinos.

-- ── 1. o elo ────────────────────────────────────────────────────────────────────────────
--
-- 🔴 NULO E "NAO TEM ANTERIOR", e ele e o chao de TODA linha que existe hoje e de toda mensagem
-- que nao foi cortada em pedacos. O `not exists` trata nulo e linha ausente pelo mesmo caminho —
-- a busca por chave primaria nao casa nada e a linha esta liberada —, e e por isso que nao existe
-- aqui um `predecessora_id is null or ...`: ele seria redundante, e um `or` no predicado desta
-- fila e uma peca a mais para alguem errar.
alter table public.mensagens
  add column if not exists predecessora_id uuid;

-- ── 2. a linha nao pode ser a propria predecessora ──────────────────────────────────────
--
-- 🔴 A UNICA FORMA DE BLOQUEIO PERMANENTE QUE O SQL CONSEGUE FECHAR SOZINHO. Uma linha
-- `pendente` apontando para si mesma satisfaz o predicado de bloqueio para sempre: ela espera o
-- proprio desfecho, que so viria depois de ela ser servida. O produto nunca escreve isso — mas
-- "o produto nunca escreve" e disciplina, e restricao e estrutura.
--
-- `not valid` PULA a verificacao das linhas que ja existem, e aqui isso nao deixa buraco nenhum:
-- a coluna nasceu na instrucao acima, entao TODA linha existente tem `predecessora_id` nulo e
-- passaria na verificacao de qualquer jeito. O que o `not valid` compra e a VARREDURA (nao a
-- trava: `add constraint` toma trava exclusiva de um jeito ou de outro), e numa tabela que cresce
-- uma linha por mensagem recebida E enviada essa varredura e o custo de boot que nao se paga.
--
-- Guardado por catalogo porque o Postgres nao tem `add constraint if not exists`, e uma segunda
-- passada nao pode falhar. O `conrelid` entra junto: nome de restricao e unico por TABELA, nao
-- por banco, e conferir so o nome acusaria uma homonima de outra tabela.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'mensagens_predecessora_nao_e_ela_mesma'
       and conrelid = 'public.mensagens'::regclass
  ) then
    alter table public.mensagens
      add constraint mensagens_predecessora_nao_e_ela_mesma
      check (predecessora_id is distinct from id) not valid;
  end if;
end $$;

-- ── 3. a reserva passa a respeitar a ordem ──────────────────────────────────────────────
--
-- 🔴 O QUE MUDOU E UM CONJUNTO NO `where` INTERNO. Todo o resto e verbatim da `0022`, e cada peca
-- que ficou tem um jeito silencioso de morrer, ja escrito la:
--   · `enviando_desde = coalesce(m.enviando_desde, now())` PRESERVA o carimbo de quem ja estava
--     em voo. Trocar por `now()` apaga a unica prova de que um processo morreu no meio de um
--     envio, e toda linha volta a parecer recem-reservada — ou seja, e REENVIADA ao cliente;
--   · `for update skip locked` e o que impede dois containers de pegarem a mesma linha. Sem o
--     `skip locked`, o segundo fica BLOQUEADO esperando o primeiro e o tick inteiro trava atras
--     de um envio lento;
--   · `order by criado_em` e a ordem de nascimento, e e a coluna do indice parcial: o `limit` do
--     teto por tick e atendido percorrendo o indice na ordem em vez de ordenar um conjunto.
--     🔴 ELE NAO E QUEM GARANTE A ORDEM DAS BOLHAS, e nao pode ser. As tres bolhas nascem em
--     inserts SEPARADOS, mas em sequencia rapida, e nada garante que o relogio as distinga:
--     MEDIDO na bancada, com as idas ao banco instantaneas, as tres bolhas de uma mesma
--     resposta saem com `origem_em` IDENTICO (mesmo milissegundo, tres de tres). `criado_em` e
--     outro relogio — o do servidor de dados, com resolucao maior — mas e a mesma classe de
--     aposta, e ela nao foi medida contra um Postgres. Quem garante a ordem e o portao acima,
--     que nao compara instante nenhum: enquanto a anterior estiver na fila, a seguinte nao e
--     nem servida. Empate de relogio entre bolhas irmas passa a ser inofensivo;
--   · ela NAO recebe workspace, e a excecao e deliberada — o dreno roda no tick, que e processo
--     do deploy e nao sessao. O isolamento nao cai junto: o `workspace_id` de cada linha vem do
--     banco e escopa tudo o que a linha toca depois.
create or replace function public.reservar_mensagens(p_limite int, p_reserva interval)
returns setof public.mensagens language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.mensagens m
     set enviando_desde = coalesce(m.enviando_desde, now()),
         proxima_tentativa = now() + p_reserva
   where m.id in (
     select id from public.mensagens
      where status = 'pendente' and direcao = 'saida' and desistido_em is null
        and coalesce(proxima_tentativa, criado_em) <= now()
        -- A BOLHA N+1 NAO SAI ENQUANTO A N NAO TIVER DESFECHO. Os tres conjuntos de dentro sao
        -- os tres conjuntos desta fila, aplicados a predecessora: enquanto ela estiver NA FILA,
        -- esta linha espera; no instante em que ela sai da fila — por sucesso, por desistencia,
        -- por marca de orfa ou por ter sido apagada — esta linha e servida no tick seguinte.
        and not exists (
          select 1
            from public.mensagens p
           where p.id = mensagens.predecessora_id
             and p.status = 'pendente' and p.direcao = 'saida' and p.desistido_em is null
        )
      order by criado_em
      limit p_limite
      for update skip locked
   )
  returning m.*;
end $$;
