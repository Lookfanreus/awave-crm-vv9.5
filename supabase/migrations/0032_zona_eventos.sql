-- 0032_zona_eventos.sql — a fila de eventos da ZONA do comprador (`custom/eventos/`).
--
-- Aditivo/expand-only: uma tabela nova, duas funções novas e um `create or replace` da
-- `enfileirar_evento`. Nada é dropado, nenhuma coluna muda, e um deploy que ainda não rodou
-- isto continua funcionando exatamente como antes.
--
-- ═══ POR QUE UMA FILA PRÓPRIA, E NÃO A DO WEBHOOK ══════════════════════════════
--
-- Desde a `0020`, `enfileirar_evento` só grava em `eventos_webhook` quando o workspace tem
-- webhook ATIVO — porque o outbox acumulava em todo deploy que nunca ligou a IA. Consequência:
-- um handler do comprador pendurado naquela fila veria ZERO em qualquer instalação sem o
-- upsell. E dois consumidores na mesma linha disputariam um ciclo de vida (reserva, backoff,
-- desistência) que já está em produção há semanas.
--
-- Fila separada = ciclo de vida separado. O rollback desta migration é `create or replace` da
-- `enfileirar_evento` de volta ao corpo da `0020`: a fila nova para de encher e o egress não
-- sente nada.
--
-- ═══ POR QUE A FUNÇÃO É ALTERADA, E NÃO DUPLICADA ══════════════════════════════
--
-- A alternativa era deixar a `enfileirar_evento` intacta e criar 4 triggers novas em paralelo.
-- Só que as 4 triggers da `0007` (`trg_contato_lead_novo`, `trg_negocio_novo`,
-- `trg_negocio_etapa`, `trg_negocio_status`) **montam o payload cada uma** — duplicá-las seria
-- manter quatro payloads em dois lugares, e a divergência entre as cópias não daria erro em
-- lugar nenhum: a fila do comprador simplesmente entregaria um formato diferente do que a
-- documentação promete, meses depois de alguém ter mexido só num lado.
--
-- Aqui a função é o único lugar que decide PARA ONDE vai o payload; quem o monta continua
-- sendo cada trigger, sem cópia.
--
-- ═══ A PROVA DE NÃO-REGRESSÃO (medida, não afirmada) ═══════════════════════════
--
-- Alterar função que está em produção exige mostrar que a fila antiga não mudou. Medido no
-- banco de desenvolvimento em 15/08/2026, chamando `enfileirar_evento` diretamente sob as
-- quatro combinações das duas chaves, e contando as duas filas antes e depois:
--
--   webhook   porteiro      eventos_webhook   eventos_custom
--   ─────────────────────────────────────────────────────────
--   OFF       OFF                  +0                +0        (o estado de todo deploy hoje)
--   ON        OFF                  +1                +0        ← a não-regressão: 0020 intacta
--   ON        ON                   +1                +1        ← independentes
--   OFF       ON                   +0                +1        ← o ponto da fatia: evento sem IA
--
-- E pelo caminho REAL (trigger `negocios_etapa`, movendo um negócio de etapa com o porteiro
-- ligado e o webhook desligado): `custom +1, webhook +0`, com o payload completo
-- (`negocio`, `de_etapa_id`, `para_etapa_id`) — o MESMO que a fila do webhook receberia,
-- porque vem da mesma trigger. É o argumento da fonte única, verificado.

-- == a fila ================================================================
-- Mesma anatomia de `eventos_webhook` (0007) de propósito: quem conhece uma conhece a outra.
create table public.eventos_custom (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tipo text not null,
  payload jsonb not null,
  criado_em timestamptz not null default now(),
  processado_em timestamptz,
  tentativas int not null default 0,
  proxima_tentativa timestamptz not null default now(),
  ultimo_erro text,
  desistido_em timestamptz
);
create index eventos_custom_pendentes_idx on public.eventos_custom (proxima_tentativa)
  where processado_em is null and desistido_em is null;
alter table public.eventos_custom enable row level security;
create policy eventos_custom_service_role on public.eventos_custom
  for all to service_role using (true) with check (true);
-- SEM policy de membro: ninguém no painel lê esta fila, igual ao outbox do egress.

-- == o porteiro ============================================================
-- Sem ele, esta fila acumula em TODO deploy que nunca escreveu um handler — que é exatamente
-- o bug que a `0020` consertou na fila do webhook, de volta com outro nome. Quem mantém o
-- `settings` em dia é o braço do tick, comparando com o que existe em `custom/eventos/`.
--
-- ⚠️ As colunas de `settings` são `key`/`value` (inglês), apesar do resto do banco ser PT-BR.
-- Com `search_path = ''` os nomes só são resolvidos na EXECUÇÃO, então um nome errado aqui
-- passaria no `create` e explodiria no primeiro evento — dentro da escrita do vendedor.
-- 🔴 O PORTEIRO É UMA BATIDA, NÃO UM BOOLEANO — e a diferença é o rollback.
--
-- Com `'true'`, um comprador que usasse o **Desfazer** da atualização voltaria o código (o
-- dreno e a poda vão junto) mas deixaria a migration e o settings como estavam: a trigger
-- continuaria enfileirando para sempre, sem ninguém consumindo. A dívida que a `0020` pagou,
-- entrando de novo pela porta do rollback.
--
-- Guardando o INSTANTE da última batida do tick e exigindo que ele seja recente, o sistema se
-- fecha sozinho: sem código novo rodando, ninguém renova a marca e em uma hora a fila para de
-- encher. Nada para o comprador fazer, nada para o suporte explicar.
--
-- O `case` (e não um `and` com regex) porque o Postgres não garante ordem de avaliação em
-- `where`: um valor não-numérico poderia estourar no cast DENTRO da escrita do vendedor.
create or replace function public.zona_eventos_ativa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.settings s
    where s.key = 'custom_eventos_ativos'
      and (case when s.value ~ '^[0-9]+$' then s.value::bigint else 0 end)
          > extract(epoch from now())::bigint - 3600
  );
$$;
revoke all on function public.zona_eventos_ativa() from public, anon, authenticated;
grant execute on function public.zona_eventos_ativa() to service_role;

-- == a fan-out =============================================================
-- 🔴 O bloco do WEBHOOK abaixo é o corpo da `0020`, com a guarda invertida de
-- `if not exists ... then return` para `if exists ... then insert`. É a mesma condição e o
-- mesmo insert (inclusive a ordem das colunas): a inversão existe só porque agora há uma
-- segunda fila depois dele, e um `return` antecipado a mataria.
create or replace function public.enfileirar_evento(p_tipo text, p_ws uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Sem destino, não há o que enfileirar. `ativo` faz parte da condição: desligar o webhook
  -- na tela tem que parar de acumular, não só parar de entregar.
  if exists (
    select 1 from public.webhook_config c
    where c.workspace_id = p_ws and c.ativo
  ) then
    insert into public.eventos_webhook (workspace_id, tipo, payload) values (p_ws, p_tipo, p_payload);
  end if;

  -- Fila da ZONA — independente da de cima, e num bloco de exceção PRÓPRIO.
  --
  -- 🔴 Esta função roda DENTRO do insert/update do vendedor. Sem o bloco, qualquer problema
  -- numa fila que é opcional (tabela ausente num banco meio-migrado, disco cheio, permissão)
  -- viraria "não consigo mover o negócio" na tela de quem está trabalhando. O `raise warning`
  -- deixa rastro no log do Postgres em vez de a falha sumir — silêncio aqui seria pior que a
  -- falha, porque o handler simplesmente nunca rodaria e ninguém saberia por quê.
  if public.zona_eventos_ativa() then
    begin
      insert into public.eventos_custom (workspace_id, tipo, payload) values (p_ws, p_tipo, p_payload);
    exception when others then
      raise warning 'eventos_custom: enfileiramento falhou (%): %', sqlstate, sqlerrm;
    end;
  end if;
end $$;

-- == o claim atômico =======================================================
-- Espelho de `reservar_eventos` (0007): PostgREST não faz row-locking, então RPC. A reserva
-- bumpa `proxima_tentativa` para que dois ticks concorrentes nunca peguem a mesma linha; na
-- falha, o dreno reescreve com o backoff real.
create or replace function public.reservar_eventos_custom(p_limite int, p_reserva interval default interval '2 minutes')
returns setof public.eventos_custom language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.eventos_custom e
    set proxima_tentativa = now() + p_reserva
  where e.id in (
    select id from public.eventos_custom
    where processado_em is null and desistido_em is null and proxima_tentativa <= now()
    order by criado_em
    limit p_limite
    for update skip locked
  )
  returning e.*;
end $$;
revoke all on function public.reservar_eventos_custom(int, interval) from public, anon, authenticated;
grant execute on function public.reservar_eventos_custom(int, interval) to service_role;
