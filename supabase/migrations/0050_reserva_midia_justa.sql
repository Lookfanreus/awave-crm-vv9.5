-- 0050_reserva_midia_justa.sql — a fila de midia deixa de ser FIFO do deploy inteiro.
--
-- ⚠️ ADITIVA. So substitui o corpo de uma funcao, por `create or replace` de assinatura
-- IDENTICA. Nenhuma coluna nasce, nenhuma sai, nenhum indice muda, e a chamada de
-- `midia-tick.ts` (`p_limite`, `p_reserva`) continua resolvendo palavra por palavra. Migration
-- que falha e container que NAO SOBE, em toda instalacao.
--
-- 🔴 O DEFEITO: UM INQUILINO MOVIMENTADO TRANCA TODOS OS OUTROS DO SERVIDOR.
-- A `0026` ordena por `criado_em` no deploy inteiro e leva `p_limite` linhas, sem nenhum
-- recorte por espaco de trabalho. A vazao do dreno e do SERVIDOR: `TETO_POR_TICK` = 5 e o tick
-- roda a cada ~30s, ou seja ~10 midias por minuto para todos os inquilinos somados. O limitador
-- de INGRESSO, por outro lado, e POR CANAL: o balde admite 2 eventos por segundo sustentados
-- (`BALDE_CANAL`, `src/lib/canais/rateLimit.ts`), ou ~120 por minuto — DOZE VEZES a vazao do
-- dreno, e por canal.
--
-- O desfecho e uma agencia com quatro clientes no mesmo deploy: o cliente A recebe 400 fotos
-- numa campanha, a fila leva ~40 minutos so para o acervo dele, e uma foto que chega para o
-- cliente B fica atras daquilo por ordem de relogio. A tela de B mostra "Baixando o arquivo..."
-- por dezenas de minutos, sem erro nenhum e sem nada em log — o modo de falha mais caro que
-- existe, porque ninguem tem o que investigar.
--
-- 🔴 O CONSERTO E O RODIZIO, e ele e o mesmo trade que o modulo irmao ja escolheu para outra
-- fila (`inbox-acoes.ts`, "o slot da fila nao e capado"), so que aqui pago em vez de aceito:
-- cada linha pendente recebe a POSICAO dela DENTRO do proprio espaco de trabalho
-- (`row_number() over (partition by workspace_id order by criado_em)`), e o lote e servido por
-- `posicao` antes de `criado_em`. Com quatro inquilinos na fila, cada um leva a mais antiga
-- dele antes de qualquer um levar a segunda.
--
-- 🔴 E COM UM UNICO ESPACO DE TRABALHO O RESULTADO E IDENTICO AO DE HOJE — preservar a vazao do
-- caso comum e metade da justificativa desta mudanca, e o comum e o deploy de UM inquilino.
-- A conta: numa particao so, `row_number()` numera 1..N na propria ordem de `criado_em`, entao
-- `posicao` e uma funcao estritamente crescente de `criado_em` e `order by posicao, criado_em`
-- produz exatamente a mesma sequencia que `order by criado_em` produzia. Nenhuma linha muda de
-- lugar.
--
-- ⚠️ O QUE MUDOU DE CLASSE, E NAO E A ORDEM: A REPOSICAO SOB CONTENCAO. Na `0026` o `limit`
-- ficava ACIMA do travamento, entao uma linha travada por outro processo era pulada e a varredura
-- REPUNHA com a proxima — o lote saia sempre com `p_limite`. Aqui o conjunto ja chega congelado
-- (`id in (...)`), entao o que estiver travado sai do lote e NADA o repoe: o lote encolhe, e no
-- limite volta vazio. A aritmetica de quando isso morde, escrita para quem for mexer:
--   · a unica concorrencia possivel e dois ticks vivos ao mesmo tempo, e o caso real disso e a
--     reconstrucao no painel (o container antigo ainda serve enquanto o novo sobe);
--   · a janela de choque NAO e a do download (esse dura ate 100s, e quem o protege e o carimbo
--     `reservadaAte`, de 5 min): e a duracao desta UNICA instrucao, sub-milissegundo;
--   · o pior caso e um tick voltar com menos de 5, ate zero. O tick seguinte, ~30s depois, volta
--     ao lote cheio — o que o outro levou ja esta carimbado e sai do predicado. Ou seja: ate 5
--     anexos atrasados em ~30 segundos, sem repeticao e sem perda.
-- ⚠️ E o predicado de frescor saiu do nivel que trava. Quem impede duas reservas da mesma linha
-- continua sendo o carimbo, nao a requalificacao do lock. Nenhuma das duas coisas foi medida
-- contra um banco — as duas estao na lista do que so o Postgres confirma.
--
-- 🔴 A FORMA ANINHADA NAO E ENFEITE: `FOR UPDATE` NAO CONVIVE COM FUNCAO DE JANELA NO MESMO
-- NIVEL DE CONSULTA. O Postgres recusa `select ... row_number() over (...) ... for update` com
-- "FOR UPDATE is not allowed with window functions". Por isso o `row_number` vive numa
-- subconsulta propria e o `for update skip locked` fica no nivel que le a tabela, exatamente
-- onde ele ja estava na `0026`.
--
-- 🔴 E O ERRO NAO APARECE NO BOOT — quem achatar os dois niveis NAO descobre pelo deploy.
-- Este corpo e `language plpgsql`: o validador que o `check_function_bodies` roda faz PARSE do
-- SQL embutido, e a recusa acima e analise SEMANTICA. E a mesma razao por que uma funcao plpgsql
-- que cita tabela inexistente e criada sem reclamar e so estoura quando roda. Entao a migration
-- aplica limpa, o container SOBE, e o erro so sai na PRIMEIRA CHAMADA — que e `drenarMidia`, e
-- ela roda sob `.catch` no tick (`src/app/api/interno/tick/route.ts`). O desfecho real e um
-- `console.warn` no log do container e a FILA DE MIDIA PARANDO CALADA em toda instalacao: o
-- sintoma exato do defeito que esta migration conserta, agora permanente. NAO HA REDE EMBAIXO
-- DISTO NO BOOT: quem mexer nesta forma confere contra um Postgres antes, ou nao mexe.
-- ⚠️ Este paragrafo descreve comportamento DOCUMENTADO do validador de plpgsql, NAO uma medicao:
-- nenhuma versao achatada foi submetida a um Postgres. Uma versao anterior dele prometia o
-- oposto ("a migration falha, o container nao sobe"), e essa e a promessa perigosa — ela diz ao
-- proximo leitor que ele nao precisa conferir.
--
-- ⚠️ O PRECO, MEDIDO ATE ONDE DA PARA MEDIR SEM O BANCO. A janela obriga a ler o conjunto
-- PENDENTE inteiro e ordena-lo por `(workspace_id, criado_em)`; a forma antiga podia parar nas
-- cinco primeiras entradas do indice. O conjunto varrido NAO e a tabela: e exatamente o que o
-- indice parcial `mensagens_midia_pendente_idx` (`0024`) recorta — `midia->>'status' =
-- 'pendente'` —, e cada linha sai dele no instante em que o dreno a carimba `ok` ou `erro`.
-- A aritmetica do pior caso realista:
--   · o caso do relato (400 fotos numa tarde, um inquilino) deixa ~400 linhas pendentes no pico;
--   · o pior caso SUSTENTADO e um canal no teto do ingresso contra o dreno: 120/min de entrada
--     menos 10/min de saida = +110/min, ou ~6.600 linhas por hora de rajada continua.
-- Ordenar milhares de linhas de tres colunas e trabalho desprezivel a cada 30 segundos.
-- ⚠️ E O QUE EU NAO SEI, dito: nao sei o `work_mem` deste servidor, entao nao sei em que
-- contagem a ordenacao passa a usar disco. O que da para afirmar e o formato do problema — o
-- conjunto pendente so cresce sem limite se o ingresso vencer o dreno por horas seguidas, que e
-- exatamente a situacao que esta migration existe para aliviar, e que ja aparece na tela do
-- comprador como anexo preso em "Baixando o arquivo...".
--
-- ⚠️ NADA MAIS MUDA, de proposito: `p_limite` e `p_reserva` continuam sendo os mesmos
-- parametros, o carimbo `reservadaAte` continua sendo gravado do mesmo jeito e no mesmo lugar,
-- e o predicado da fila continua PALAVRA POR PALAVRA o mesmo da `0026` — que e o mesmo do
-- indice parcial da `0024`. Divergir dele nao da erro em lugar nenhum: o indice simplesmente
-- deixa de ser usado, e o dreno volta a varrer `mensagens` inteira.
--
-- ⚠️ E NAO HA `revoke`/`grant` AQUI. `create or replace` de assinatura identica PRESERVA a lista
-- de permissoes da funcao: as linhas da `0026` (que revogam de `public`, `anon` e
-- `authenticated` e concedem so a `service_role`) continuam sendo as autoritativas. Repeti-las
-- aqui nao acrescentaria nada; troca-las por `drop function` + `create function` e que
-- reabriria a porta, porque a criacao reganharia o EXECUTE que o `ALTER DEFAULT PRIVILEGES` do
-- Supabase concede a `authenticated`.
create or replace function public.reservar_midias(p_limite int, p_reserva interval)
returns setof public.mensagens language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.mensagens m
     set midia = jsonb_set(m.midia, '{reservadaAte}', to_jsonb((now() + p_reserva)::text), true)
   where m.id in (
     select id from public.mensagens
      where id in (
        -- O RODIZIO. `posicao` e o lugar da linha na fila DO PROPRIO espaco de trabalho; servir
        -- por `posicao` antes de `criado_em` faz cada inquilino levar a mais antiga dele antes
        -- de qualquer um levar a segunda. `criado_em` continua sendo o desempate, e e ele que
        -- torna o caso de um inquilino so identico ao de antes.
        select fila.id
          from (
            select id,
                   criado_em,
                   row_number() over (partition by workspace_id order by criado_em) as posicao
              from public.mensagens
             where midia->>'status' = 'pendente'
               -- Livre: nunca reservada, ou reserva vencida (o processo morreu no meio do tick).
               and (midia->>'reservadaAte' is null or (midia->>'reservadaAte')::timestamptz <= now())
          ) fila
         order by fila.posicao, fila.criado_em
         limit p_limite
      )
      for update skip locked
   )
  returning m.*;
end $$;
