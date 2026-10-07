-- 0038_perfil_pendente.sql — o contato de canal opaco pode nascer SEM nome, e alguem precisa
-- ir buscar esse nome depois.
--
-- ⚠️ ADITIVA. Tres colunas novas e NULAS, mais um indice parcial e uma funcao: nenhuma linha
-- muda, nenhuma coluna some, nenhum dominio se estreita. Migration que falha = container que
-- NAO SOBE, em toda instalacao: o EasyPanel mantem a versao anterior servindo e o comprador
-- fica sem entender por que a atualizacao "nao pegou".
--
-- 🔴 POR QUE ISTO EXISTE, E POR QUE A BUSCA NAO PODE MORAR NO RECEBIMENTO. O canal de
-- mensagens diretas do Instagram entrega o identificador de quem escreveu, e NAO o nome nem o
-- @. Uma caixa de entrada cheia de `17841400008460056` parece quebrada, e quem instalou nao tem
-- como saber que o dado nunca veio. Buscar o nome custa uma chamada a Meta — e o endereco de
-- recebimento e PUBLICO e nao autenticado: uma chamada externa por mensagem entregaria a quem
-- manda a mensagem um botao para fazer o servidor de quem comprou chamar a Meta, quantas vezes
-- ele quiser. Por isso a linha nasce MARCADA aqui e o relogio interno a completa depois.
--
-- ⚠️ AS TRES NASCEM NULAS de proposito, e nao `not null default`. Todo contato que ja existe
-- fica com as tres vazias, o que le como "isto nao se aplica a mim" — que e a verdade: nenhum
-- contato de telefone precisa de busca de nome nenhuma. Nulo tambem e o que mantem o indice
-- parcial abaixo minusculo em toda instalacao que nunca ligou o canal.

-- A marca: esta linha esta esperando que alguem descubra o nome dela.
--
-- 🔴 TRES VALORES, e a diferenca entre `null` e `false` e usada: `null` = nunca se aplicou
-- (todo contato de telefone, e todo contato que ja existia antes desta versao) · `true` = esta
-- na fila · `false` = a fila ja terminou com ela, por ter achado o nome ou por ter desistido.
-- Colapsar `false` em `null` apagaria a distincao entre "nunca tentamos" e "tentamos e nao
-- deu", que e justamente o que a tela precisa saber para explicar o identificador na tela em
-- vez de parecer quebrada.
alter table public.contatos
  add column if not exists perfil_pendente boolean;

-- Quantas vezes a busca ja falhou nesta linha.
--
-- 🔴 SEM ELE A BUSCA NUNCA MORRE. Sem a permissao concedida no painel da Meta, a chamada falha
-- SEMPRE — nao e falha de rede que passa. Um contador e uma desistencia sao o que impedem essas
-- linhas de ocuparem a cota por rodada para sempre e empurrarem as linhas legitimas para nunca.
alter table public.contatos
  add column if not exists perfil_tentativas smallint;

-- Ate quando esta linha esta reservada por uma rodada.
--
-- ⚠️ E ele e o freio DE GRACA: linha reservada so volta a ser elegivel quando a janela expira.
-- Isso muda o ritmo da retentativa de "toda rodada" para "a cada janela", que e o
-- comportamento certo para falha de rede.
alter table public.contatos
  add column if not exists perfil_reservado_ate timestamptz;

-- ── o indice da fila ───────────────────────────────────────────────────────────────────
--
-- 🔴 PARCIAL, E O PREDICADO E IGUAL AO DA CONSULTA. Sem ele, a fila varre `contatos` INTEIRA a
-- cada rodada do relogio interno — e `contatos` e uma das tabelas que mais crescem no CRM. O
-- sintoma nao aparece em dev nem no primeiro mes: ele aparece na instalacao com volume, como um
-- relogio interno que fica lento e nunca mais volta. E e esse mesmo relogio que revalida a
-- licenca.
--
-- ⚠️ `where perfil_pendente` deixa `null` DE FORA, porque no Postgres nulo nao e verdadeiro.
-- Isso e o que mantem o indice com poucas dezenas de linhas numa instalacao em dia, em vez de
-- uma linha por contato ja cadastrado.
--
-- A coluna indexada e `criado_em` porque a fila ordena por ela: assim o teto por rodada vira a
-- leitura das primeiras entradas do indice, e nao uma ordenacao do conjunto inteiro.
create index if not exists contatos_perfil_pendente_idx
  on public.contatos (criado_em)
  where perfil_pendente;

-- ── a reserva ──────────────────────────────────────────────────────────────────────────
--
-- 🔴 `for update skip locked`, E NAO UM `select` SEGUIDO DE `update`. Duas rodadas concorrentes
-- pegariam AS MESMAS LINHAS, e os tres estragos sao os mesmos que a fila de arquivos ja pagou:
-- a mesma chamada externa e feita N vezes; `perfil_tentativas` vira lost-update (as duas leem 0
-- e gravam 1), entao a desistencia conta menos do que deveria; e o teto por rodada, que existe
-- para o relogio interno nao passar fome, e furado ENTRE rodadas.
--
-- ⚠️ `returns setof public.contatos`, e NAO `setof uuid` — mesmo que quem chama so precise de
-- algumas colunas. E deliberado, e a forma ja esta em producao neste produto nas duas filas
-- irmas: a codificacao que a camada de API devolve para ela e FATO CONFERIDO. Para `setof
-- <tipo escalar>` a codificacao seria outra (um array de escalares, e nao de objetos), e quem
-- chama teria de mudar NO MESMO COMMIT. O preco de esquecer ja foi medido do outro lado: o
-- `.map(l => l.id)` devolve `[undefined, ...]`, o filtro seguinte e serializado como
-- `id=in.(undefined)`, o Postgres recusa com 22P02 e a rodada inteira levanta erro.
--
-- ⚠️ O teto e PARAMETRO, nao constante daqui: quem decide quantas chamadas externas cabem numa
-- rodada e o codigo que paga o relogio, e duas copias do mesmo numero divergem em silencio.
create or replace function public.reservar_perfis(p_limite int, p_reserva interval)
returns setof public.contatos language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.contatos c
     set perfil_reservado_ate = now() + p_reserva
   where c.id in (
     select id from public.contatos
      where perfil_pendente
        -- Livre: nunca reservada, ou reserva vencida (o processo morreu no meio da rodada).
        and (perfil_reservado_ate is null or perfil_reservado_ate <= now())
      order by criado_em
      limit p_limite
      for update skip locked
   )
  returning c.*;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de public/anon. No Supabase o ALTER DEFAULT
-- PRIVILEGES concede EXECUTE a `authenticated` na CRIACAO da funcao, entao um revoke que nao
-- NOMEIE esse papel nao tira nada. Aqui o preco de esquecer seria direto: `security definer`
-- bypassa a seguranca de linha, entao qualquer pessoa autenticada de qualquer espaco de
-- trabalho reservaria (e assim ESCONDERIA por uma janela inteira) os contatos de todos os
-- outros — e, de quebra, leria as linhas de `contatos` que a funcao devolve.
revoke all on function public.reservar_perfis(int, interval) from public, anon, authenticated;
grant execute on function public.reservar_perfis(int, interval) to service_role;
