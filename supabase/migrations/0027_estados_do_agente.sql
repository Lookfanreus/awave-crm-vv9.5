-- 0027_estados_do_agente.sql — alarga tres dominios de estado e faz a conversa preservar o
-- estado dela quando uma mensagem nova chega.
--
-- ⚠️ ADITIVA. Migration que falha = container que NAO SOBE, em toda instalacao: o EasyPanel
-- mantem a versao anterior servindo e o comprador fica sem entender por que a atualizacao
-- "nao pegou". Nada aqui exige ownership de tabela do Supabase e nada aqui apaga dado —
-- alargar um `check` e expand-only: toda linha que ja existe continua valida.

-- ── os tres dominios ───────────────────────────────────────────────────────────────────
--
-- 🔴 A CONSTRAINT ANTIGA E ACHADA PELO CATALOGO, nunca pelo nome. O nome que o Postgres da a
-- um `check` declarado inline e `<tabela>_<coluna>_check`, mas isso e convencao do gerador,
-- nao contrato: um banco que nasceu de restore, de um `pg_dump` antigo ou de um `create
-- table` editado a mao pode ter outro nome, e `drop constraint <nome errado>` derruba o boot
-- de quem ja pagou. A 0025 resolveu o mesmo problema para as FKs e este laco herda a forma.
--
-- 🔴 O QUE ELE NAO HERDA DA 0025 E O DISCRIMINANTE, e copia-lo seria o defeito mais caro
-- deste arquivo. La o laco filtra por `confrelid` — a tabela referenciada —, e e ele que
-- reduz o conjunto a uma FK so. `check` NAO TEM `confrelid` (a coluna existe e vale 0),
-- entao um `contype = 'c'` sozinho sobre `public.mensagens` casa as TRES checks anonimas que
-- a 0022 declarou inline: `direcao`, `autor` e `status`. Derrubaria as tres e recriaria UMA.
-- O boot nao falha, o laco continua re-executavel, e o banco do comprador perde duas
-- constraints de integridade para sempre, sem uma linha de log.
--
-- O discriminante correto e a COLUNA: `conkey` e o vetor de colunas da constraint, e exigir
-- que ele seja exatamente `[attnum]` pega o `check` de UMA coluna — a alvo — e ignora os das
-- outras. O `attnum` sai do `pg_attribute`.
--
-- As tres linhas da lista abaixo sao os tres unicos alvos. `mensagens.direcao` NAO esta la,
-- e a ausencia dela e o ponto: e a constraint que o discriminante errado levaria junto.
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
      ('public.conversas'::text, 'status'::text,
       $novo$status in ('aberta', 'arquivada', 'assumida', 'aguardando_humano')$novo$::text,
       array['aberta,arquivada',
             'aberta,arquivada,assumida,aguardando_humano']::text[]),
      ('public.mensagens', 'autor',
       $novo$autor in ('contato', 'membro', 'aparelho', 'agente')$novo$,
       array['contato,membro,aparelho',
             'contato,membro,aparelho,agente']),
      ('public.mensagens', 'status',
       $novo$status in ('recebida', 'pendente', 'enviada', 'entregue', 'lida', 'falhou', 'descartada')$novo$,
       array['recebida,pendente,enviada,entregue,lida,falhou',
             'recebida,pendente,enviada,entregue,lida,falhou,descartada'])
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
        raise warning '[0027] ATENCAO: check % de %.% reconhecida so pela metade (nome=%, definicao=%). Ela NAO foi derrubada e o dominio NAO foi alargado — o valor novo sera recusado ate alguem conferir. Definicao encontrada: %',
          c.conname, alvo.tabela, alvo.coluna, nomeia, nossa, c.def;
      else
        raise notice '[0027] check % de %.% PRESERVADA (nao e nossa): ela NAO foi alargada — confira se ainda aceita os valores novos',
          c.conname, alvo.tabela, alvo.coluna;
      end if;
    end loop;

    -- 🔴 NOME NOVO E DISTINTO, e a escolha e o par da guarda logo abaixo. O nome que o
    -- Postgres gera para um `check` inline e `<tabela>_<coluna>_check` — que e exatamente o
    -- nome que o laco acima acabou de derrubar. Guardar o `add` por ESSE nome seria um `drop`
    -- incondicional protegido por um `add` condicional ao MESMO nome: num banco em que ele ja
    -- estivesse ocupado por um `check` de OUTRA coluna, o laco derrubaria o certo (pelo
    -- `conkey`) e a guarda engoliria o `add` — a coluna ficaria SEM `check`, o boot passaria
    -- verde e a migration ficaria registrada como aplicada. Nao e "nao alargou": e apagou.
    --
    -- Com um nome que so este arquivo produz, o conjunto derrubado e o nome guardado sao
    -- disjuntos no caminho normal, e a guarda volta a significar so o que ela deve significar.
    nome := replace(alvo.tabela, 'public.', '') || '_' || alvo.coluna || '_dominio_check';
    -- A guarda NAO e o que torna este arquivo re-executavel — o laco e. O `check` criado aqui
    -- e um `check` de uma coluna so sobre a coluna alvo, entao numa segunda passada ele cai no
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

-- ── a conversa passa a preservar o estado dela ─────────────────────────────────────────
--
-- 🔴 MUDA UMA LINHA SO, e ela roda em TODO caminho de mensagem do produto: no registro do
-- que chega e, uma vez por pedaco, em tudo o que sai. A 0022 gravava `status = 'aberta'` sem
-- condicao, com o comentario "mensagem nova reabre conversa arquivada" — e enquanto os
-- estados eram dois, "reabrir a arquivada" e "gravar 'aberta'" eram a mesma coisa. Com
-- quatro, a atribuicao vira um RESET: `assumida` e `aguardando_humano` dizem "uma pessoa
-- esta com esta conversa", e sobrescreve-los faz a mensagem seguinte apagar esse registro.
--
-- O `case` preserva LITERALMENTE o que a 0022 pagou para ter: `arquivada` volta para
-- `aberta`, nos dois caminhos. `aberta` cai no `else` e se atribui a si mesma, entao NENHUMA
-- linha muda de valor no dia em que isto e aplicado — o `update` continua tocando
-- `ultima_mensagem_em`, `nao_lidas` e `atualizado_em` exatamente como antes.
--
-- E aqui nao ha nome de constraint para errar: `create or replace` troca o corpo no lugar. A
-- assinatura e a MESMA de antes de proposito — assinatura diferente cria uma SEGUNDA funcao
-- em vez de trocar esta, e o codigo continuaria chamando a antiga, sem erro nenhum.
create or replace function public.registrar_mensagem_na_conversa(
  p_ws uuid, p_conversa uuid, p_quando timestamptz, p_entrada boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.conversas c
     set ultima_mensagem_em = greatest(coalesce(c.ultima_mensagem_em, p_quando), p_quando),
         status = case when c.status = 'arquivada' then 'aberta' else c.status end,
         ultima_msg_in_at = case when p_entrada
           then greatest(coalesce(c.ultima_msg_in_at, p_quando), p_quando)
           else c.ultima_msg_in_at end,
         nao_lidas = case when p_entrada then c.nao_lidas + 1 else c.nao_lidas end,
         atualizado_em = now()
   where c.workspace_id = p_ws and c.id = p_conversa;
end $$;

-- 🔴 REPETIDO DE PROPOSITO. `create or replace` preserva a ACL de uma funcao que ja existe,
-- entao num banco em que a 0022 rodou inteira estas duas linhas nao mudam nada. Elas existem
-- para o banco em que ela NAO rodou inteira — restore parcial, `pg_dump` antigo, funcao
-- recriada a mao: no Supabase o `alter default privileges` concede EXECUTE a `authenticated`
-- na CRIACAO da funcao, entao numa copia em que o revoke ficou para tras esta funcao ficaria
-- executavel por papel indevido. Custa duas linhas e fecha o caso.
revoke all on function public.registrar_mensagem_na_conversa(uuid, uuid, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.registrar_mensagem_na_conversa(uuid, uuid, timestamptz, boolean)
  to service_role;
