-- 0028_fila_do_agente.sql — a fila de resposta automatica: uma rodada viva por conversa.
--
-- ⚠️ ADITIVA. Migration que falha = container que NAO SOBE, em toda instalacao: o EasyPanel
-- mantem a versao anterior servindo e o comprador fica sem entender por que a atualizacao
-- "nao pegou". Nada aqui apaga dado, nada exige ownership de objeto do Supabase, e a coluna
-- nova nasce anulavel.
--
-- Tudo e guardado por `if not exists`. Nao e zelo: as migrations historicas deste banco foram
-- aplicadas a mao pelo editor de SQL, e um banco em que a tabela ja exista mas a policy nao
-- pararia o boot no `create policy` — que e o pior desfecho possivel de um arquivo aditivo.

create table if not exists public.atendimento_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversa_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'dead')),
  -- Quando a rodada fica elegivel. E o relogio do agrupamento: mensagem nova o EMPURRA, e e
  -- ele que o dreno compara na hora de concluir — se alguem o empurrou durante a rodada, a
  -- conclusao nao casa e a linha volta para a fila em vez de a mensagem nova ficar orfa.
  nao_antes timestamptz not null default now(),
  tentativas int not null default 0,
  max_tentativas int not null default 3,
  -- Cinto contra o cliente em rajada. Cada rodada daqui roda num processo diferente, entao um
  -- contador em memoria nao sobrevive de uma para a outra: ou ele e duravel, ou o teto nao
  -- existe e uma linha a cada dois segundos faz toda resposta ser descartada pela seguinte,
  -- para sempre, pagando o modelo sem nunca falar.
  descartes int not null default 0,
  ultimo_erro text,
  -- Carimbado UMA vez, na reserva, e nunca mais tocado: e o cracha de quem reservou. Toda
  -- escrita do dreno o repete no filtro, entao um processo que perdeu a reserva nao consegue
  -- mais mexer na linha — nem que ela ja tenha voltado a `running` nas maos de outro.
  heartbeat_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ⚠️ A GUARDA NOMEIA A RELACAO, e nao so a constraint. Nome de constraint e unico por TABELA no
-- Postgres: uma constraint homonima em outra tabela faria a guarda achar aquela, engolir o `add`
-- daqui, e a FK nunca existir — sem erro, com a migration registrada como aplicada. Vale para as
-- tres formas (`conrelid`, `tgrelid`, `tablename`), e ha teste de disco cruzando as duas pontas.
--
-- 🔴 FK COMPOSTA, como as que a migration anterior de mensageria criou. Sem ela uma linha pode
-- afirmar um workspace e apontar para conversa de outro, e o dreno resolveria canal, chave e
-- credencial pelo lado errado. `conversas` ja tem o unico `(workspace_id, id)` que serve de
-- alvo, e `on delete cascade` mantem a fila limpa quando a conversa vai embora.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'atendimento_jobs_conversa_fk'
                   and conrelid = 'public.atendimento_jobs'::regclass) then
    alter table public.atendimento_jobs
      add constraint atendimento_jobs_conversa_fk
      foreign key (workspace_id, conversa_id)
      references public.conversas (workspace_id, id) on delete cascade;
  end if;
end $$;

-- 🔴 UMA RODADA VIVA POR CONVERSA. E este indice que transforma "agendar" em "empurrar o
-- relogio" em vez de "criar outro job", e e ele que impede duas rodadas simultaneas na mesma
-- conversa — o defeito mais caro deste produto, o cliente lendo duas vozes.
create unique index if not exists atendimento_jobs_conversa_viva_idx
  on public.atendimento_jobs (conversa_id) where status in ('queued', 'running');

-- A fila propriamente dita.
create index if not exists atendimento_jobs_fila_idx
  on public.atendimento_jobs (nao_antes) where status = 'queued';
-- As reservas abandonadas por um processo que morreu no meio.
create index if not exists atendimento_jobs_frios_idx
  on public.atendimento_jobs (heartbeat_em) where status = 'running';

-- 🔴 OS TRES INDICES DA JANELA DE UMA HORA. A propria fila e o registro de quantas rodadas
-- houve — a linha e escrita no caminho critico e nao e apagada —, e sem estes indices a
-- contagem varreria a tabela a cada rodada.
--
-- ⚠️ E daqui sai uma consequencia que precisa estar escrita: a linha concluida NAO e lixo. Ela
-- e a prova de uma rodada dentro da janela, e apagar linha concluida com menos de uma hora
-- ABRE os tres tetos de uma vez. Quem for desenhar expurgo tem de saber disso.
create index if not exists atendimento_jobs_janela_idx
  on public.atendimento_jobs (conversa_id, atualizado_em desc);
create index if not exists atendimento_jobs_ws_janela_idx
  on public.atendimento_jobs (workspace_id, atualizado_em desc);
create index if not exists atendimento_jobs_deploy_janela_idx
  on public.atendimento_jobs (atualizado_em desc);

-- `atualizado_em` e mantido pelo BANCO, e nao por quem escreve. Ele nao e cosmetico: e a
-- coluna que a janela de uma hora le, entao uma escrita que esquecesse de atualiza-lo tiraria
-- aquela rodada da contagem e afrouxaria os tres tetos em silencio.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'atendimento_jobs_set_atualizado'
                 and tgrelid = 'public.atendimento_jobs'::regclass) then
    create trigger atendimento_jobs_set_atualizado before update on public.atendimento_jobs
      for each row execute function public.set_atualizado_em();
  end if;
end $$;

-- ── RLS ────────────────────────────────────────────────────────────────────────────────
--
-- SEM policy de membro, de proposito: nenhuma tela le esta tabela. Ela e mecanica interna,
-- escrita e lida so pelo servidor — o que o comprador ve e a CONSEQUENCIA dela, no fio da
-- conversa. E o mesmo caso das outras filas internas deste banco.
alter table public.atendimento_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'atendimento_jobs'
       and policyname = 'atendimento_jobs_service'
  ) then
    create policy atendimento_jobs_service on public.atendimento_jobs
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- ── a pausa do aparelho ────────────────────────────────────────────────────────────────
--
-- Quando sai uma mensagem pelo APARELHO — o dono respondendo pelo celular —, a conversa passa
-- a `assumida` e este carimbo marca a hora. E o sinal mais forte que existe de que uma pessoa
-- entrou na conversa, mais forte que qualquer heuristica; e tem prazo porque o contrario
-- tambem e ruim, um "so um minuto" digitado no celular desligaria a resposta automatica para
-- sempre.
--
-- ⚠️ Ela tem DOIS escritores, e eles significam coisas diferentes com o mesmo status. O eco do
-- aparelho grava `assumida` com `atribuida_a` NULO — pausa com prazo. Assumir a conversa pela
-- caixa de entrada grava `assumida` com `atribuida_a` PREENCHIDO — e essa nao expira. Quem
-- separa os dois casos e `atribuida_a`, nunca este carimbo, e colapsar os dois faria o
-- atendimento de uma pessoa evaporar no meio.
--
-- (A caixa de entrada escreve o status por dois caminhos: arquivar, que nao toca esta coluna, e
-- atribuir, que a escreve ao assumir e a limpa ao devolver. A funcao que registra a mensagem
-- devolve a conversa arquivada a `aberta` na fala seguinte do cliente. Uma versao anterior
-- deste comentario dizia que nenhuma acao de la escrevia o status; nao e verdade, e a diferenca
-- importa para quem for ler estados aqui.)
alter table public.conversas add column if not exists assumida_em timestamptz;

-- ── reserva atomica da fila ────────────────────────────────────────────────────────────
--
-- 🔴 `for update skip locked` e o que permite mais de um processo drenando a mesma fila sem
-- que os dois peguem a MESMA linha. Aqui isso nao e hipotese: o relogio do deploy dispara em
-- intervalo fixo e sem guarda de sobreposicao, entao dois ticks concorrentes sao o caso
-- normal sempre que um deles passa do intervalo. Dois processos na mesma conversa e o cliente
-- recebendo duas respostas.
--
-- 🔴 ELA NAO TOCA `nao_antes`, e isso e o oposto do que a reserva da fila de saida faz. Ali o
-- carimbo futuro E a reserva; aqui `nao_antes` e o relogio do agrupamento E o valor que o
-- dreno compara para saber se chegou mensagem nova durante a rodada. Reescreve-lo na reserva
-- apagaria essa comparacao — e a mensagem que chegasse durante a rodada sumiria em silencio.
-- Quem reserva a linha e a troca de `status` mais o carimbo de `heartbeat_em`.
--
-- 🔴 O SEGUNDO RAMO E O BACKSTOP, e ele INCREMENTA a tentativa. Uma reserva cujo carimbo
-- esfriou e um processo que morreu com o job na mao — e isso e uma tentativa gasta, mesmo sem
-- ninguem ter registrado erro. Sem o incremento, um job que derruba o processo toda vez seria
-- reservado para sempre, sem nunca alcancar o teto de tentativas e sem nunca morrer.
--
-- 🔴 E ela NAO RECEBE workspace: o dreno roda no tick, que e um processo do deploy e nao uma
-- sessao — nao existe "workspace atual" ali. Filtrar por workspace obrigaria a varrer
-- workspace a workspace. O isolamento nao cai junto: o workspace de cada linha vem do banco e
-- escopa tudo o que o codigo toca depois.
create or replace function public.reservar_jobs(p_limite int, p_frio interval)
returns setof public.atendimento_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.atendimento_jobs j
     set status = 'running',
         heartbeat_em = now(),
         tentativas = case when j.status = 'running' then j.tentativas + 1 else j.tentativas end
   where j.id in (
     select id from public.atendimento_jobs
      where (status = 'queued' and nao_antes <= now())
         or (status = 'running' and heartbeat_em < now() - p_frio)
      order by nao_antes
      limit p_limite
      for update skip locked
   )
  returning j.*;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de public/anon. No Supabase o
-- `alter default privileges` concede EXECUTE a `authenticated` na CRIACAO da funcao, entao
-- revogar de public/anon NAO tira esse grant. Sem estas duas linhas, qualquer autenticado de
-- qualquer workspace chamaria a funcao — e ela e `security definer`, roda como dona e devolve
-- LINHAS da tabela inteira, do deploy inteiro.
revoke all on function public.reservar_jobs(int, interval) from public, anon, authenticated;
grant execute on function public.reservar_jobs(int, interval) to service_role;
