-- 0026_reserva_midia.sql — reserva atomica da fila de midia.
--
-- ⚠️ ADITIVA. So cria funcao. Migration que falha = container que NAO SOBE.
--
-- 🔴 O PADRAO JA EXISTIA NO MODULO IRMAO, ESCRITO NA MESMA FATIA, e nao atravessou: a fila de
-- SAIDA reserva com `reservar_mensagens` (`for update skip locked` + carimbo), e a de MIDIA
-- fazia um `select ... limit 5` cru. O tick roda a cada ~30s e um lote de midia passa disso
-- com facilidade (5 downloads de ate 20 MB, com timeout de 20s cada), entao ticks concorrentes
-- pegavam AS MESMAS 5 LINHAS. Tres estragos, todos em uso normal:
--
--   1. o mesmo arquivo e baixado e subido N vezes — banda do comprador e do provider;
--   2. `tentativas` vira lost-update (os dois ticks leem 0 e gravam 1), entao a desistencia
--      conta menos do que deveria e midia morta retenta mais do que o teto permite;
--   3. cada tick calcula a cota por conta propria e os dois concluem que ha espaco: A COTA E
--      FURADA ENTRE TICKS, que e justamente o teto que impede o Storage do comprador de
--      estourar.
--
-- 🔴 O CARIMBO MORA NO PROPRIO `midia` (jsonb), e nao numa coluna nova. Nao e economia: a
-- fila de midia JA e definida por um campo desse jsonb (`midia->>'status' = 'pendente'`, o
-- predicado do indice parcial da 0024), entao o estado dela cabe no mesmo lugar em que ela e
-- lida. Uma coluna `midia_reservada_ate` em `mensagens` — tabela que cresce sem teto — seria
-- nula em 99% das linhas e criaria uma segunda fonte de verdade para a mesma fila.
--
-- ⚠️ E ele e o backoff DE GRACA: linha reservada so volta a ser elegivel quando a janela
-- expira. Isso muda o ritmo da retentativa de "todo tick" para "a cada janela", o que e o
-- comportamento certo para falha de rede — e e o unico freio que a recusa por COTA tem, ja que
-- ela nao gasta tentativa (ver `midia-tick.ts`).
--
-- ⚠️ E O PRECO DESSE PAR, porque "a cota se cura sozinha" faz parecer que retentar e de graca.
-- Nao e. Falha de rede DESISTE (o dreno para em 3 tentativas); recusa por cota, nao — a linha
-- volta intacta, sem gastar tentativa. Num deploy que ficou no teto e nao e esvaziado, a carga
-- passa a ser PERMANENTE: a cada janela o tick reserva o proximo lote, paga uma medicao inteira
-- do bucket (listagem do raiz + uma por prefixo de workspace) e grava DUAS UPDATEs por linha —
-- a desta funcao, que carimba a reserva, e a do dreno, que reescreve o `midia` IGUAL ao que
-- leu. As duas caem em `mensagens`, que a 0022 poe na publicacao `supabase_realtime`, entao as
-- duas viram evento de tempo real na caixa de entrada de quem estiver com ela aberta.
--
-- E trade ACEITO e de taxa limitada — a janela e o teto do ritmo, e matar a midia por cota
-- deixaria o anexo indisponivel PARA SEMPRE na thread, que e pior. Fica escrito para quem for
-- mexer no teto, na janela ou no ritmo do tick saber o que esta comprando.
--
-- ⚠️ Premissa escrita: `reservadaAte` so e gravado POR ESTA FUNCAO. O `midia` nasce em
-- `midiaParaJson`, que monta o objeto campo a campo (kind, mime, refExterna, legenda, status)
-- — nada do envelope do webhook entra nele por espalhamento. Se um dia entrar, o cast
-- `::timestamptz` abaixo passa a ser alcancavel por quem manda a mensagem, e um valor
-- invalido faz a funcao INTEIRA erguer erro (a fila de midia para, visivelmente, em vez de
-- degradar em silencio).
--
-- ⚠️ `returns setof public.mensagens`, e NAO `setof uuid` — mesmo que o chamador so use o
-- `id`. E deliberado: `reservar_mensagens` (0022) ja usa essa forma e ela esta em producao,
-- entao a codificacao que o PostgREST devolve para ela e FATO CONFERIDO neste produto. Para
-- `setof <tipo escalar>` a codificacao seria outra (array de escalares, e nao de objetos), e o
-- chamador teria de mudar NO MESMO COMMIT.
--
-- O preco de esquecer foi MEDIDO, e ele nao e silencioso: `drenarMidia` faz `.map(l => l.id)`,
-- que sobre strings devolve `[undefined, ...]`; o `.in('id', …)` do postgrest-js serializa isso
-- como `id=in.(undefined)`, o Postgres recusa com 22P02 (`invalid input syntax for type uuid`)
-- e o `if (error) throw error` do dreno LANCA. O tick volta 500, alto e visivel — nenhuma midia
-- e baixada, mas ninguem fica adivinhando por que. Uma versao anterior deste comentario
-- prometia o oposto ("fila sempre vazia, sem log nem excecao"); ele descrevia um modo de falha
-- que nao existe, e este arquivo e ENTREGUE ao comprador inteiro (o stripper do Hub nao apaga
-- comentario de `.sql`).
--
-- O que continua caro de verdade, e e a razao da escolha: cada tick JA reservou as 5 linhas
-- antes de estourar, entao a fila avanca o carimbo sem processar nada. Uma forma ja provada
-- vale mais que a economia de trafego de cinco linhas por tick.
create or replace function public.reservar_midias(p_limite int, p_reserva interval)
returns setof public.mensagens language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.mensagens m
     set midia = jsonb_set(m.midia, '{reservadaAte}', to_jsonb((now() + p_reserva)::text), true)
   where m.id in (
     select id from public.mensagens
      where midia->>'status' = 'pendente'
        -- Livre: nunca reservada, ou reserva vencida (o processo morreu no meio do tick).
        and (midia->>'reservadaAte' is null or (midia->>'reservadaAte')::timestamptz <= now())
      order by criado_em
      limit p_limite
      for update skip locked
   )
  returning m.*;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de public/anon — a 0008 deste banco existe
-- inteira para consertar exatamente essa falha da 0007: no Supabase o ALTER DEFAULT PRIVILEGES
-- concede EXECUTE a `authenticated` na CRIACAO da funcao. Aqui o preco de esquecer seria
-- direto: `security definer` bypassa RLS, entao qualquer autenticado de qualquer workspace
-- reservaria (e assim ESCONDERIA por uma janela inteira) a midia de todos os tenants.
revoke all on function public.reservar_midias(int, interval) from public, anon, authenticated;
grant execute on function public.reservar_midias(int, interval) to service_role;
