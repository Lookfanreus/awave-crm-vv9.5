-- 0047_rodadas_pagas.sql — os tres tetos do assistente passam a contar RODADA PAGA, e nao mais
-- LINHA DA FILA.
--
-- ⚠️ ADITIVA: uma coluna com `default` e uma funcao nova. Nenhuma coluna sai, nenhuma linha muda
-- de valor, nenhuma chamada existente para de resolver. Migration que falha e container que NAO
-- SOBE, em toda instalacao — e as duas funcoes que reservam trabalho (`reservar_jobs` e
-- `reservar_job_da_conversa`) declaram `returns setof public.atendimento_jobs` e devolvem `j.*`,
-- entao a coluna nova viaja para o codigo sem que nenhuma delas precise ser recriada.
--
-- 🔴 A UNIDADE ERRADA ERRAVA NOS DOIS SENTIDOS, e cada um tinha um dano proprio.
--
-- PARA MENOS: o registro de custo roda ANTES de qualquer desvio, de proposito, porque rodada
-- abortada ja queimou tokens; e o descarte de pre-envio faz `requeue` — o estado da linha volta a
-- `queued`, e a contagem da janela so enxerga `done` e `dead`. A rodada era paga e sumia da conta.
-- Com o teto de descartes em 2, cada linha contada valia ate TRES rodadas pagas, e o teto de 12
-- por conversa valia ~36 na fatura de quem instalou.
--
-- PARA MAIS: um clique de teste RECUSADO pelo teto do simulador vira linha `done` sem nunca ter
-- chamado o modelo (ele tem de virar: deixa-la `queued` trava a cabeca da fila do deploy
-- inteiro). Como o teto do deploy e 500, quinhentos cliques que nao custam um centavo calavam o
-- assistente de TODOS os inquilinos daquele servidor por uma hora.
--
-- Nenhuma expressao conserta isso: as duas unidades sao coisas diferentes, e a contagem tem de
-- sair de um contador que so quem CHAMOU o modelo incrementa. Por isso e esquema, e nao codigo.

-- ── o contador ─────────────────────────────────────────────────────────────────────────
--
-- 🔴 `default 0` E OBRIGATORIO, e nao estilo: sem ele o `not null` seria recusado em toda tabela
-- que ja tem linha, e o boot morreria na instalacao de quem ja usa o assistente. Com ele, o
-- Postgres grava o padrao no catalogo e nao reescreve a tabela.
--
-- 🔴 E NAO HA BACKFILL, DE PROPOSITO. `atendimento_jobs` tem gatilho `before update` que grava
-- `atualizado_em = now()` incondicionalmente — e `atualizado_em` E a coluna que a janela de uma
-- hora le. Um `update` de backfill arrastaria as linhas dos ultimos 30 dias (a retencao do
-- expurgo) para DENTRO da janela e fecharia os tres tetos por uma hora depois de cada
-- atualizacao, em toda instalacao: o assistente de quem comprou ficaria mudo sem ninguem saber
-- por que. O preco de nao fazer e o oposto e e limitado: as linhas que terminaram na hora
-- ANTERIOR ao boot contam zero, entao na primeira hora os tres tetos contam menos do que
-- contariam. Como a migration roda durante a reconstrucao do container — com o produto FORA do ar
-- —, ninguem esta pagando rodada nesse intervalo, e a janela se recompoe sozinha em uma hora com
-- dado verdadeiro. Contar de menos por uma hora, uma vez, e mais barato que calar o produto por
-- uma hora a cada atualizacao, sempre.
alter table public.atendimento_jobs
  add column if not exists rodadas_pagas int not null default 0;

comment on column public.atendimento_jobs.rodadas_pagas is
  'Quantas rodadas PAGAS esta linha ja custou. So quem chamou o modelo incrementa: recusa barata, curto-circuito e erro antes da chamada valem zero. E a unidade dos tres tetos do assistente — nunca escreva daqui um valor que nao corresponda a uma chamada de modelo que de fato aconteceu.';

-- ── as tres somas da janela ────────────────────────────────────────────────────────────
--
-- 🔴 POR QUE UMA FUNCAO, E NAO TRES CONSULTAS COM `count`. O servidor de dados nao agrega: para
-- somar uma coluna do lado de ca seria preciso trazer as linhas da janela e somar em memoria —
-- sem paginacao e sem teto, que e exatamente o defeito que a `0046` acabou de tirar do painel de
-- gasto. Ele corta o resultado num teto proprio e devolve sucesso sem dizer nada, e o efeito aqui
-- seria pior que num painel: o teto contaria MENOS do que existe justamente no deploy
-- movimentado, que e onde ele importa. Pedir um teto explicito so trocaria o corte mudo dele pelo
-- nosso. A soma tem de acontecer onde o dado esta.
--
-- 🔴 UMA VARREDURA, TRES RECORTES. As tres contagens antigas eram tres idas ao banco sobre a
-- MESMA janela; aqui elas viram tres `filter` sobre uma leitura so. A da conversa e um
-- subconjunto da do espaco, que e um subconjunto da do deploy — varrer o superconjunto uma vez e
-- recortar e estritamente menos trabalho, e o indice `(atualizado_em desc)` da `0028` continua
-- sendo o caminho.
--
-- 🔴 A TERCEIRA NAO TEM RECORTE, E A AUSENCIA E O REQUISITO. O teto de cima defende a FATURA, e a
-- fatura e do deploy: um recorte por espaco de trabalho o transformaria numa copia do teto do
-- espaco e ele pararia de defender a unica coisa que ninguem consegue rebobinar. Quem chama e o
-- papel de servico, num processo do deploy; nao existe "espaco de trabalho atual" ali.
--
-- 🔴 `coalesce` NAS TRES. `sum` de zero linhas e NULO, e nulo comparado a um teto e sempre falso
-- — o teto deixaria de existir sem uma linha de erro, e justamente no deploy novo, que e onde
-- ninguem esta olhando.
--
-- ⚠️ SO `done` E `dead`. A linha em maos ainda e `running` e fica de fora de proposito: quem a
-- soma e o chamador, com o contador que ele leu na reserva. Incluir `running` aqui a contaria
-- duas vezes.
--
-- 🔴 ELA NAO E `security definer`, pelo mesmo motivo da `0046`: quem a chama e o papel de
-- servico, que ignora as regras de linha de qualquer jeito, entao rodar como dona nao compraria
-- nada e custaria a unica rede que sobra. Rodando como QUEM CHAMA, um privilegio que vazasse para
-- o token do navegador ainda esbarraria nas regras de `atendimento_jobs`, que nao tem policy de
-- membro nenhuma: o resultado seria zero, e nao a fila do servidor inteiro.
create or replace function public.rodadas_pagas_na_janela(
  p_desde timestamptz,
  p_ws uuid,
  p_conversa uuid
)
returns table (
  conversa bigint,
  workspace bigint,
  deploy bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(j.rodadas_pagas) filter (
      where j.workspace_id = p_ws and j.conversa_id = p_conversa
    ), 0),
    coalesce(sum(j.rodadas_pagas) filter (where j.workspace_id = p_ws), 0),
    coalesce(sum(j.rodadas_pagas), 0)
  from public.atendimento_jobs j
  where j.status in ('done', 'dead')
    and j.atualizado_em >= p_desde
$$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de `public`/`anon`. Neste servidor de dados o
-- privilegio padrao concede EXECUTE a `authenticated` na CRIACAO da funcao, e o token desse papel
-- esta no NAVEGADOR (a caixa de entrada ja o entrega la por causa do tempo real). Esta funcao
-- atravessa espacos de trabalho de proposito: o privilegio sobrando diria a qualquer autenticado
-- quanto o assistente do servidor inteiro rodou na ultima hora.
revoke all on function public.rodadas_pagas_na_janela(timestamptz, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.rodadas_pagas_na_janela(timestamptz, uuid, uuid) to service_role;

comment on function public.rodadas_pagas_na_janela(timestamptz, uuid, uuid) is
  'As rodadas PAGAS desde um instante, em tres recortes: a conversa, o espaco de trabalho e o deploy inteiro. O terceiro nao filtra por espaco de proposito — a fatura e do deploy. Conta so linhas concluidas ou mortas: a linha em maos ainda esta em execucao e quem a soma e quem chama.';
