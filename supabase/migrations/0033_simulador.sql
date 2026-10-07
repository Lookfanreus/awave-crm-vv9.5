-- 0033_simulador.sql — o canal de teste do assistente: o dominio de provider e a reserva
-- dirigida de uma rodada.
--
-- ⚠️ ADITIVA. Migration que falha = container que NAO SOBE, em toda instalacao: o EasyPanel
-- mantem a versao anterior servindo e o comprador fica sem entender por que a atualizacao
-- "nao pegou". Nada aqui apaga dado e nada exige ownership de objeto do Supabase — alargar um
-- `check` e expand-only: toda linha que ja existe continua valida.

-- ── o dominio de provider ──────────────────────────────────────────────────────────────
--
-- O canal de teste e um provider como outro qualquer: mesma tabela, mesma conversa, mesma
-- fila. So que o adapter dele nao chama ninguem. Sem alargar este dominio, criar a linha
-- devolve um erro de restricao cru na tela de quem so queria testar o assistente.
--
-- 🔴 A CONSTRAINT ANTIGA E ACHADA PELO CATALOGO, nunca pelo nome. O nome que o Postgres da a
-- um `check` declarado inline e convencao do gerador, nao contrato: um banco que nasceu de
-- restore, de um dump antigo ou de um `create table` editado a mao pode ter outro, e
-- `drop constraint <nome errado>` derruba o boot de quem ja pagou.
--
-- 🔴 E O DISCRIMINANTE E A COLUNA, nunca so o tipo da constraint. `check` nao tem a coluna de
-- tabela referenciada que serve de filtro para chave estrangeira, entao um filtro por tipo
-- sozinho casaria TODAS as checks de uma coluna so da mesma tabela e derrubaria as outras
-- junto — sem erro, sem log, e com o banco do comprador perdendo integridade para sempre.
-- `conkey` e o vetor de colunas da constraint: exigir que ele seja exatamente `[attnum]` pega
-- o `check` da coluna alvo e ignora os das outras.
do $$
declare
  alvo record;
  c    record;
  n    smallint;
  nome text;
  padrao text;
  valores text[];
  nossa boolean;
  nomeia boolean;
begin
  for alvo in
    select * from (values
      ('public.canais'::text, 'provider'::text,
       $novo$provider in ('uazapi', 'simulador')$novo$::text,
       array['uazapi',
             'uazapi,simulador']::text[])
    ) as t(tabela, coluna, novo_check, dominios)
  loop
    -- Sem `into strict`: coluna ausente deixa `n` nulo em vez de levantar, e a mensagem
    -- abaixo diz QUAL coluna sumiu. Um erro de catalogo cru nao diria.
    select a.attnum into n
      from pg_attribute a
     where a.attrelid = alvo.tabela::regclass
       and a.attname  = alvo.coluna
       and not a.attisdropped;
    if n is null then
      raise exception 'coluna %.% nao encontrada', alvo.tabela, alvo.coluna;
    end if;

    -- 🔴 O LACO SO DERRUBA O QUE E NOSSO, e sao DUAS perguntas — o nome E a definicao.
    --
    -- Ele comecou sem filtro nenhum: derrubava TODA check de uma coluna so sobre a coluna alvo.
    -- Isso alcancava a zona de customizacao — `custom/migrations/` (faixa 9000+) e ponto de
    -- extensao documentado e ENTREGUE, e e justamente o que sobrevive a toda atualizacao. Uma
    -- check que o comprador criasse ali sobre esta mesma coluna caia no laco, era derrubada na
    -- release seguinte e nao voltava: a regra dele parava de valer sem erro, sem log e sem nada
    -- na tela — e ele acreditando que a zona esta preservada, porque e o que a zona promete.
    --
    -- 🔴 E O NOME SOZINHO NAO RESOLVE ISSO NUNCA. O comprador que escreve
    -- `alter table public.conversas add check (status <> 'spam')`, sem nomear, recebe do Postgres
    -- exatamente `<tabela>_<coluna>_check` — um dos nomes desta lista. Ele nao desobedeceu regra
    -- nenhuma; ele nem soube que estava nomeando. E a base fica livre depois da primeira
    -- alargada: a nossa vira `_dominio_check`, `_check` fica vago, e a dele cai bem ali.
    --
    -- 🔴 POR ISSO O DISCRIMINANTE DE VERDADE E A DEFINICAO. Nos sabemos exatamente como era cada
    -- dominio oficial anterior desta coluna — eles estao escritos na coluna `dominios` do
    -- `values` acima, um por migration que ja alargou esta mesma coluna, e crescem de forma
    -- monotonica. A comparacao e por CONJUNTO DE VALORES extraidos de `pg_get_constraintdef`, e
    -- nao pelo texto: o Postgres reescreve `in (…)` como `= any (array[…])`, muda espaco e
    -- acrescenta `::text`, mas os literais entre aspas sao os mesmos em qualquer forma. Comparar
    -- texto seria comparar a formatacao do catalogo; comparar conjunto e comparar o dominio.
    --
    -- ⚠️ RESIDUO CONHECIDO, e ele e estreito: uma check do comprador cujo conjunto de valores
    -- seja EXATAMENTE um dominio oficial anterior desta coluna E cujo nome caia no padrao ainda
    -- e derrubada. Ex.: `add check (provider <> 'uazapi')` num banco em que o dominio oficial
    -- anterior era so `('uazapi')`. Fechar isso exigiria olhar a FORMA da expressao (pertinencia
    -- vs. negacao), e nao da: o catalogo imprime `in ('x')` de um valor so como `= 'x'`, entao um
    -- filtro por forma deixaria de reconhecer a NOSSA propria check — que e a falha muda.
    --
    -- ⚠️ E O QUE ACONTECE QUANDO SO UMA METADE CASA E ALTO, NAO MUDO. Nesse caso nao derrubamos
    -- (pode ser do comprador) e o `add` abaixo e engolido pela guarda de nome, entao a coluna
    -- fica com o dominio ANTIGO e o valor novo continua recusado. Isso sai como `warning` no log
    -- do boot, com a definicao inteira, porque e o unico desfecho aqui em que o produto fica
    -- diferente do que a release promete. Nao levantamos excecao de proposito: migration que
    -- falha e container que NAO SOBE, em toda instalacao, e derrubar o CRM inteiro e pior que um
    -- canal novo que nao entra.
    padrao := '^' || replace(alvo.tabela, 'public.', '') || '_' || alvo.coluna
                  || '_(check[0-9]*|dominio_check)$';

    for c in
      select conname, pg_get_constraintdef(oid) as def from pg_constraint
       where conrelid = alvo.tabela::regclass
         and contype  = 'c'
         and conkey   = array[n]::smallint[]
    loop
      -- Os literais da definicao, na ordem em que aparecem. Coluna e cast nao entram: no texto
      -- do catalogo so os VALORES vem entre aspas simples.
      select coalesce(array_agg(t.m[1]), '{}')
        into valores
        from regexp_matches(c.def, '''([^'']*)''', 'g') as t(m);

      -- Igualdade de CONJUNTO nos dois sentidos (`<@` em ambos), e nao string ordenada: ordem e
      -- ordenacao dependeriam do collation do banco do comprador.
      select coalesce(bool_or(d <@ valores and valores <@ d), false)
        into nossa
        from (select string_to_array(x, ',') as d from unnest(alvo.dominios) as x) as u;

      nomeia := c.conname ~ padrao;

      if nomeia and nossa then
        -- `%s` na tabela e `%I` no nome: a tabela vem qualificada com o schema, e `%I` a
        -- transformaria num identificador so, entre aspas.
        execute format('alter table %s drop constraint %I', alvo.tabela, c.conname);
      elsif nomeia or nossa then
        raise warning '[0033] ATENCAO: check % de %.% reconhecida so pela metade (nome=%, definicao=%). Ela NAO foi derrubada e o dominio NAO foi alargado — o valor novo sera recusado ate alguem conferir. Definicao encontrada: %',
          c.conname, alvo.tabela, alvo.coluna, nomeia, nossa, c.def;
      else
        raise notice '[0033] check % de %.% PRESERVADA (nao e nossa): ela NAO foi alargada — confira se ainda aceita os valores novos',
          c.conname, alvo.tabela, alvo.coluna;
      end if;
    end loop;

    -- 🔴 NOME NOVO E DISTINTO, e a escolha e o par da guarda logo abaixo. O nome que o
    -- Postgres gera para um `check` inline e exatamente o nome que o laco acima acabou de
    -- derrubar; guardar o `add` por ESSE nome seria um `drop` incondicional protegido por um
    -- `add` condicional ao MESMO nome. Num banco em que ele ja estivesse ocupado por um
    -- `check` de OUTRA coluna, o laco derrubaria o certo (pelo `conkey`) e a guarda engoliria
    -- o `add`: a coluna ficaria SEM `check`, o boot passaria verde e a migration ficaria
    -- registrada como aplicada. Nao e "nao alargou": e apagou.
    nome := replace(alvo.tabela, 'public.', '') || '_' || alvo.coluna || '_dominio_check';
    -- A guarda NAO e o que torna este bloco re-executavel — o laco e. O `check` criado aqui e
    -- um `check` de uma coluna so sobre a coluna alvo, entao numa segunda passada ele cai no
    -- proprio laco e e recriado. A guarda existe para o caso de colisao de nome: `add
    -- constraint` com nome ja ocupado e erro fatal, e erro fatal aqui e instalacao parada.
    if not exists (
      select 1 from pg_constraint
       where conname = nome and conrelid = alvo.tabela::regclass
    ) then
      execute format('alter table %s add constraint %I check (%s)',
                     alvo.tabela, nome, alvo.novo_check);
    end if;
  end loop;
end $$;

-- ── a reserva dirigida ─────────────────────────────────────────────────────────────────
--
-- Espelha a reserva geral da fila de atendimento — mesmo `for update skip locked`, mesmo
-- carimbo de `heartbeat_em`, mesmo incremento de tentativa no ramo frio — com DUAS diferencas
-- declaradas, e as duas sao o motivo de ela existir.
--
-- 🔴 1. ELA RECORTA POR ESPACO DE TRABALHO E POR CONVERSA. A reserva geral NAO recebe espaco
-- de trabalho de proposito: quem a chama e o relogio do servidor, que e um processo do deploy
-- e nao uma sessao — nao existe "espaco de trabalho atual" ali. Ela ordena por relogio, sem
-- recorte nenhum. Chamada a partir de uma tela, ela reivindicaria o trabalho MAIS ANTIGO DO
-- DEPLOY, que quase nunca e o de quem clicou: o clique de um inquilino tiraria da fila a
-- rodada de outro. Nao e so inseguro — nao funciona.
--
-- 🔴 2. ELA IGNORA `nao_antes`, E IGNORAR NAO E REESCREVER.
--
-- Ignorar: o agendamento grava um relogio no futuro (a espera que junta a rajada do cliente
-- numa rodada so) e o predicado da reserva geral exige que ele ja tenha vencido. Criar e
-- reivindicar na mesma acao reservaria ZERO linhas, sempre, ja na primeira tentativa. A espera
-- existe para agrupar mensagem que chega em rajada; um clique deliberado de quem opera nao e
-- rajada.
--
-- Nao reescrever: `nao_antes` tambem e o valor que o dreno compara na hora de concluir — se
-- alguem o empurrou durante a rodada, a conclusao nao casa e a linha volta para a fila em vez
-- de a mensagem nova ficar orfa. Reescreve-lo na reserva apagaria essa comparacao, e a
-- mensagem que chegasse no meio da rodada sumiria em silencio.
--
-- 🔴 `limit 1`: uma conversa tem no maximo uma rodada viva (ha indice unico parcial para
-- isso), entao pedir mais seria pedir o que nao pode existir.
create or replace function public.reservar_job_da_conversa(p_ws uuid, p_conversa uuid, p_frio interval)
returns setof public.atendimento_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.atendimento_jobs j
     set status = 'running',
         heartbeat_em = now(),
         tentativas = case when j.status = 'running' then j.tentativas + 1 else j.tentativas end
   where j.id in (
     select id from public.atendimento_jobs
      where workspace_id = p_ws
        and conversa_id = p_conversa
        and (status = 'queued' or (status = 'running' and heartbeat_em < now() - p_frio))
      order by nao_antes
      limit 1
      for update skip locked
   )
  returning j.*;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de public/anon. No Supabase o
-- `alter default privileges` concede EXECUTE a `authenticated` na CRIACAO da funcao, entao
-- revogar de public/anon NAO tira esse grant. Ela e `security definer`, roda como dona, e
-- devolve LINHAS da fila alem de vira-las para "em execucao" com carimbo fresco. Alcancavel
-- por um papel comum, ela deixaria qualquer autenticado do deploy — inclusive de outro espaco
-- de trabalho — ler a fila alheia e gastar as tentativas de uma conversa REAL ate ela morrer
-- sem nunca ser respondida.
revoke all on function public.reservar_job_da_conversa(uuid, uuid, interval) from public, anon, authenticated;
grant execute on function public.reservar_job_da_conversa(uuid, uuid, interval) to service_role;
