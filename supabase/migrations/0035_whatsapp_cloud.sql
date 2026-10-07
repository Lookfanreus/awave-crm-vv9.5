-- 0035_whatsapp_cloud.sql — o dominio de `canais.provider` passa a aceitar o canal oficial do
-- WhatsApp (a Cloud API da Meta).
--
-- ⚠️ ADITIVA. Alargar um `check` e expand-only: toda linha que ja existe continua valida, nada
-- e apagado e nada exige ownership de objeto do Supabase. Migration que falha = container que
-- NAO SOBE, em toda instalacao: o EasyPanel mantem a versao anterior servindo e o comprador
-- fica sem entender por que a atualizacao "nao pegou".

-- ── o dominio de provider ──────────────────────────────────────────────────────────────
--
-- `canais.provider` diz por qual integracao aquele canal fala, e o valor tem de ser um dos
-- slugs que esta versao do CRM conhece. O canal oficial e um provider como os outros: mesma
-- tabela, mesma conversa, mesma fila — o que muda e o adapter que fala com a Meta. Sem alargar
-- este dominio, criar a linha devolve um erro de restricao cru na tela de quem esta instalando.
--
-- 🔴 A CONSTRAINT ANTIGA E ACHADA PELO CATALOGO, nunca pelo nome. O nome que o Postgres da a
-- um `check` declarado inline e convencao do gerador, nao contrato: um banco que nasceu de
-- restore, de um dump antigo ou de um `create table` editado a mao pode ter outro, e
-- `drop constraint` por nome fixo derruba o boot de quem ja pagou.
--
-- 🔴 E derrubar por nome tem um segundo modo de falha, pior porque e SILENCIOSO: um nome que
-- ja nao existe faz o `drop ... if exists` virar no-op, o `add` seguinte tem sucesso (o nome
-- esta livre) e a tabela termina com DUAS checks sobre a mesma coluna. O Postgres avalia as
-- duas em AND, entao a mais ANTIGA continua valendo e o slug novo segue recusado — com a
-- migration aplicada limpa, o container no ar e nada em log nenhum.
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
       $novo$provider in ('uazapi', 'simulador', 'whatsapp_cloud')$novo$::text,
       array['uazapi',
             'uazapi,simulador',
             'uazapi,simulador,whatsapp_cloud']::text[])
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
        raise warning '[0035] ATENCAO: check % de %.% reconhecida so pela metade (nome=%, definicao=%). Ela NAO foi derrubada e o dominio NAO foi alargado — o valor novo sera recusado ate alguem conferir. Definicao encontrada: %',
          c.conname, alvo.tabela, alvo.coluna, nomeia, nossa, c.def;
      else
        raise notice '[0035] check % de %.% PRESERVADA (nao e nossa): ela NAO foi alargada — confira se ainda aceita os valores novos',
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
