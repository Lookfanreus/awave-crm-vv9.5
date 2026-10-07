-- 0044_recorte_transacional.sql — duas sequencias de escrita dependente passam a caber numa
-- transacao so: o recorte de um bloco da base por assistente, e a recuperacao da conversa que
-- ficou para tras quando a mensagem gravou e a atualizacao dela nao.
--
-- ⚠️ ADITIVA: so cria funcao. Nenhuma tabela muda, nenhuma coluna sai, nenhuma linha muda de
-- valor, nenhuma chamada existente para de resolver. Migration que falha e container que NAO
-- SOBE, em toda instalacao — o painel mantem a versao anterior servindo e quem comprou nao
-- entende por que a atualizacao "nao pegou".
--
-- 🔴 POR QUE FUNCAO, E NAO DUAS CHAMADAS DA APLICACAO. Pelo servidor de dados cada chamada e
-- uma transacao propria: entre a primeira e a segunda ha SEMPRE uma janela, e se a segunda
-- falhar o estado do meio e PERMANENTE. O corpo de uma funcao e uma transacao: a janela existe,
-- mas nunca escapa dela. Mesmo argumento (e mesmo molde) de `definir_assistente_padrao`.

-- ── 1. o recorte de um bloco da base ───────────────────────────────────────────────────────
--
-- 🔴 O DELETE SOZINHO ALARGA O ALCANCE, e e por isso que esta e a pior das tres. O recorte era
-- `delete` + `insert` por chamadas separadas: se o `insert` falhasse depois de o `delete` ter
-- passado, o bloco ficava SEM NENHUMA linha de recorte — e bloco sem linha vale para TODOS os
-- assistentes, por desenho (e o chao de todo espaco de trabalho que nunca recortou nada). Ou
-- seja: a falha parcial produzia o OPOSTO do que a tela pediu, com a tela dizendo ao operador
-- que tinha dado erro. O bloco que ele quis esconder de um assistente passava a valer para
-- todos eles, em silencio.
--
-- Desfechos, e eles sao NUMEROS: 1 = trocou · 0 = o bloco nao e deste espaco de trabalho ·
-- 2 = um dos assistentes nao e deste espaco de trabalho. Quem traduz cada um numa frase em
-- portugues e a acao que chama; devolver o numero mantem a funcao muda sobre QUAL identificador
-- errou, que e o que impede a resposta de confirmar um identificador chutado.
create or replace function public.trocar_recorte_do_bloco(
  p_ws uuid, p_bloco uuid, p_assistentes uuid[]
) returns int language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
  qtd int;
  validos int;
begin
  -- 🔴 O ESCOPO E CONFERIDO AQUI DENTRO, e nao so no chamador. Os dois identificadores chegam
  -- do NAVEGADOR, e uma funcao `security definer` roda com os privilegios da dona do objeto: as
  -- regras de linha NAO sao consultadas. Sem esta conferencia, recortar o bloco de outro
  -- inquilino seria uma chamada.
  --
  -- E ela vem ANTES do delete de proposito: conferir depois deixaria o delete ja feito, que e
  -- exatamente a metade que alarga o alcance.
  --
  -- 🔴 E O `for update` E O QUE TORNA A TROCA SERIALIZADA, nao so atomica — as duas palavras
  -- nao querem dizer a mesma coisa, e sem esta linha a segunda seria falsa. Sob READ COMMITTED
  -- (o padrao) duas trocas simultaneas do MESMO bloco ainda podem produzir a UNIAO dos dois
  -- recortes quando as listas sao disjuntas: a transacao T2 tira o retrato do banco antes de T1
  -- comitar, o `delete` dela nao enxerga o `insert` de T1, casa zero linhas, e as duas listas
  -- acabam somadas — o resultado que NENHUM dos dois operadores pediu, e que alarga o alcance.
  -- Travar a linha do bloco poe as duas trocas em fila: a segunda so comeca a ler depois que a
  -- primeira terminou, e o `delete` dela ja enxerga tudo.
  --
  -- O que este cadeado custa: quem estiver EDITANDO a mesma entrada da base espera esta funcao
  -- terminar (um delete e um insert de poucas linhas — nenhuma chamada de rede, nenhum
  -- embedding, acontece com o cadeado na mao). Quem apenas LE a base — inclusive a busca do
  -- assistente — nao espera nada: no Postgres leitor nao bloqueia em linha travada.
  perform 1 from public.base_conhecimento b
   where b.id = p_bloco and b.workspace_id = p_ws
   for update;
  if not found then return 0; end if;

  -- Dedup ANTES de validar: a mesma lista com um id repetido nao pode reprovar como se um dos
  -- dois fosse de outro espaco de trabalho. `array_length` de array vazio devolve NULL, nao
  -- zero — sem o `coalesce` a comparacao inteira vira NULL e o caminho fica certo por acidente.
  select coalesce(array_agg(distinct x), '{}'::uuid[]) into ids
    from unnest(coalesce(p_assistentes, '{}'::uuid[])) as x;
  qtd := coalesce(array_length(ids, 1), 0);

  if qtd > 0 then
    -- A chave estrangeira composta da juncao recusaria um assistente de fora de qualquer jeito,
    -- so que com um erro cru de Postgres e DEPOIS de o recorte anterior ja ter sido apagado.
    select count(*) into validos
      from public.assistentes a
     where a.workspace_id = p_ws and a.id = any(ids);
    if validos <> qtd then return 2; end if;
  end if;

  -- 🔴 SUBSTITUI, NAO SOMA. Apagar tudo JA E o estado "sem restricao nenhuma", e e isso que faz
  -- "voltar a valer para todos" funcionar sem uma segunda porta.
  delete from public.assistente_blocos ab
   where ab.workspace_id = p_ws and ab.bloco_id = p_bloco;

  if qtd > 0 then
    -- `workspace_id` vem de `p_ws`, e nao de uma leitura: a coluna e `not null` e participa das
    -- DUAS chaves estrangeiras compostas da juncao, que sao a unica barreira que sobra contra
    -- amarrar o bloco de um inquilino ao assistente de outro.
    insert into public.assistente_blocos (workspace_id, bloco_id, assistente_id)
    select p_ws, p_bloco, x from unnest(ids) as x;
  end if;

  return 1;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de `public`/`anon`. No Supabase o ALTER DEFAULT
-- PRIVILEGES concede EXECUTE a `authenticated` na CRIACAO da funcao, e o token desse papel esta
-- no NAVEGADOR (a caixa de entrada ja o entrega la por causa do tempo real). Como `security
-- definer` nao consulta policy nenhuma, o `grant` sobrando seria a porta inteira: qualquer
-- autenticado recortaria qualquer bloco, pulando a tela, o gate de licenca e a conferencia de
-- papel.
revoke all on function public.trocar_recorte_do_bloco(uuid, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.trocar_recorte_do_bloco(uuid, uuid, uuid[]) to service_role;

comment on function public.trocar_recorte_do_bloco(uuid, uuid, uuid[]) is
  'Troca, numa transacao so, a quais assistentes um bloco da base vale. Lista vazia devolve o bloco para todos. 1 = trocou, 0 = bloco de outro espaco, 2 = assistente de outro espaco.';

-- ── 2. a conversa que ficou para tras ──────────────────────────────────────────────────────
--
-- 🔴 A REENTREGA NAO E NO-OP, E TAMBEM NAO PODE SOMAR DE NOVO — as duas metades ao mesmo tempo,
-- e e essa tensao que obriga uma funcao propria.
--
-- No ingresso, gravar a mensagem e atualizar a conversa sao duas chamadas. Se a segunda falhar
-- (ou o processo morrer no meio), a mensagem fica gravada e a conversa fica PARADA: ela nao
-- sobe na lista, o relogio da janela de 24 h nao anda, e nada acusa. Quando o provider
-- reentrega, a mensagem colide na unicidade do identificador externo — e ate aqui o ingresso
-- desistia, o que tornava aquela falha PERMANENTE.
--
-- Chamar de novo a `registrar_mensagem_na_conversa` tambem nao serve: ela soma `nao_lidas` e
-- desarquiva sem perguntar, entao a reentrega passaria a inflar o contador e a trazer de volta
-- conversa que alguem arquivou.
--
-- 🔴 POR ISSO A CONDICAO DE ATRASO MORA NO `where` DO PROPRIO `update`. Ler a conversa antes e
-- decidir na aplicacao seriam duas transacoes de novo: duas reentregas simultaneas leriam o
-- mesmo relogio velho e somariam DUAS vezes. Numa instrucao so, a linha e travada e a segunda
-- entra ja com o relogio novo (o servidor reavalia o `where` contra a versao recem-comitada).
--
-- 🔴 E O RELOGIO E LIDO DA PROPRIA MENSAGEM, NAO RECEBIDO DE QUEM CHAMA. Esta e a correcao que
-- torna a guarda confiavel, e sem ela a funcao fazia o oposto do que existe para fazer.
-- O carimbo do evento vem do ENVELOPE, ou seja, de quem manda a mensagem, e a aplicacao tem de
-- degradar para "agora" quando ele falta ou esta fora de faixa — enquanto o identificador
-- externo (obrigatorio) continua o mesmo. Ou seja: mensagem sem carimbo chegava aqui com um
-- relogio NOVO a cada reentrega, `relogio_da_conversa < novo_agora` era SEMPRE verdadeiro, e a
-- recuperacao somava uma nao-lida e desarquivava a conversa A CADA REENTREGA — exatamente o
-- estrago que o paragrafo acima diz impedir. Num provider que erre a UNIDADE do carimbo isso
-- deixa de ser azar de uma mensagem e vira o canal inteiro.
--
-- `mensagens.origem_em` e `mensagens.direcao` sao gravados uma vez, no insert que colidiu, e
-- nunca mudam: os dois valem o mesmo em toda reentrega, que e a propriedade de que a guarda
-- precisa. Ler os dois aqui dentro NAO reabre a janela — a leitura e da linha imutavel, na
-- mesma transacao, e nao da conversa que vamos escrever.
--
-- 🔴 E O EIXO DEPENDE DA DIRECAO, o que nao e simetria. Numa mensagem de ENTRADA o que prova
-- que a chamada anterior nao rodou e `ultima_msg_in_at`; numa saida (o eco do aparelho), o unico
-- relogio que ela move e `ultima_mensagem_em`. Usar o segundo para as duas perderia a contagem
-- de uma entrada sempre que um eco tivesse empurrado o relogio geral no meio.
--
-- ⚠️ E A RECUPERACAO ERRA PARA MENOS, DE PROPOSITO — os dois lados declarados, porque so o do
-- excesso e obvio. Se a mensagem M1 (t1) perdeu a chamada, a M2 (t2 > t1) passou normalmente e
-- so entao a M1 e reentregue, o relogio ja esta em t2, a condicao e falsa e a nao-lida da M1
-- NAO e recuperada — ela se perde para sempre. E o lado certo de errar: a alternativa (somar
-- assim mesmo) devolve o contador inflado por reentrega, que e o defeito de origem.
--
-- Desfechos: quantas linhas mudaram — 0 e "ja estava em dia", o caso normal de toda reentrega
-- saudavel; -1 e "a mensagem nao esta nesta conversa", que nao se confunde com o 0.
--
-- ⚠️ E O -1 E MAIS ALCANCAVEL DO QUE "nao deveria acontecer, quem chama acabou de colidir na
-- unicidade dela". A unicidade violada e `mensagens_externo_id_key (workspace_id, externo_id)`,
-- da `0022` — SEM `conversa_id`. Um provider que reusa o mesmo identificador em chats
-- diferentes colide numa linha que vive em OUTRA conversa, e ai o escopo triplo do `select`
-- abaixo nao acha nada. O desfecho e um no-op MUDO, e continua sendo o certo: o escopo triplo
-- existe justamente porque a alternativa — casar so por `externo_id` — empurraria o relogio da
-- conversa ERRADA. Quem chama sabe disso e nao ramifica; o porque esta escrito la.
-- ⚠️ UMA SO ARIDADE, E MUDAR ISTO NAO E "trocar a assinatura". `create or replace function`
-- compara pela LISTA DE PARAMETROS: acrescentar, tirar ou trocar o tipo de um parametro nao
-- substitui a funcao — cria uma SOBRECARGA, e as duas passam a viver no banco. Quem for mexer
-- aqui derruba a antiga pelo nome COM a lista de tipos exata (lista errada e `drop` que nao
-- derruba nada, sem erro nenhum). O nome desta e sempre chamado com as tres chaves abaixo.
create or replace function public.recuperar_conversa_atrasada(
  p_ws uuid, p_conversa uuid, p_externo_id text
) returns int language plpgsql security definer set search_path = '' as $$
declare
  quando timestamptz;
  entrada boolean;
  tocadas int;
begin
  -- A linha imutavel que a reentrega acabou de colidir. O escopo e triplo de proposito: sem o
  -- `conversa_id` uma mensagem que vive em OUTRA conversa empurraria o relogio desta.
  select m.origem_em, m.direcao = 'entrada'
    into quando, entrada
    from public.mensagens m
   where m.workspace_id = p_ws and m.conversa_id = p_conversa and m.externo_id = p_externo_id;
  if not found then return -1; end if;

  update public.conversas c
     set ultima_mensagem_em = greatest(coalesce(c.ultima_mensagem_em, quando), quando),
         status = case when c.status = 'arquivada' then 'aberta' else c.status end,
         ultima_msg_in_at = case when entrada
           then greatest(coalesce(c.ultima_msg_in_at, quando), quando)
           else c.ultima_msg_in_at end,
         nao_lidas = case when entrada then c.nao_lidas + 1 else c.nao_lidas end,
         atualizado_em = now()
   where c.workspace_id = p_ws and c.id = p_conversa
     and case when entrada
           then coalesce(c.ultima_msg_in_at, '-infinity'::timestamptz) < quando
           else coalesce(c.ultima_mensagem_em, '-infinity'::timestamptz) < quando
         end;
  get diagnostics tocadas = row_count;
  return tocadas;
end $$;

-- Mesma razao do bloco acima: `security definer` que escreve nao pode ficar alcancavel pelo
-- token que o navegador carrega.
revoke all on function public.recuperar_conversa_atrasada(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.recuperar_conversa_atrasada(uuid, uuid, text)
  to service_role;

comment on function public.recuperar_conversa_atrasada(uuid, uuid, text) is
  'Atualiza a conversa a partir de uma mensagem reentregue, com o relogio lido da propria mensagem, e SO se o relogio da conversa ainda estiver atras dele. Devolve o numero de linhas tocadas: 0 quando nao havia o que recuperar, -1 quando a mensagem nao esta nesta conversa.';
