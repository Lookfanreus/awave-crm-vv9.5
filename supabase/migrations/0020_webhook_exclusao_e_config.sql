-- 0020_webhook_exclusao_e_config.sql — duas dívidas do egress (0007), pagas juntas porque as
-- duas moram nas mesmas funções.
--
-- Aditivo/expand-only: só `create or replace` de função e triggers NOVAS. Nada é dropado,
-- nenhuma coluna muda, e um deploy que ainda não rodou isto continua funcionando como antes.
--
-- ═══ DÍVIDA 1 · O OUTBOX ACUMULAVA EM TODO DEPLOY, INCLUSIVE SEM IA ═══════════
--
-- As 4 triggers da `0007` chamam `enfileirar_evento` SEM consultar `webhook_config`. Como a
-- integração com a IA é upsell e a esmagadora maioria dos deploys nunca a liga, todo comprador
-- vinha gravando uma linha em `eventos_webhook` a cada contato criado, negócio criado, etapa
-- mudada e negócio fechado — para um destino que não existe. Medido: ~57 linhas em 11 dias só
-- no banco de desenvolvimento, que quase não é usado.
--
-- Isso não estava quebrado, estava DESPERDIÇANDO: o dreno do tick marca `sem_config` depois de
-- 7 dias e as linhas se auto-limpam — **desde que o heartbeat esteja ligado**. Num deploy com o
-- heartbeat desligado, a tabela crescia para sempre.
--
-- A partir daqui a fila só recebe evento de workspace com webhook ATIVO configurado.
--
-- ⚠️ CONSEQUÊNCIA ACEITA, E ELA É DESEJÁVEL: evento ocorrido ANTES de a integração ser
-- configurada não é gravado, então ligar a IA não entrega um retrospecto. É o comportamento
-- certo — o contrário seria despejar meses de histórico no endpoint da IA no minuto em que ele
-- nasce, e um consumidor novo tratando isso como "acabou de acontecer" agiria sobre negócio
-- que já foi fechado há muito tempo.
--
-- ⚠️ O DRENO NÃO MUDA. `src/server/webhook/entrega.ts` continua conferindo a config por linha e
-- marcando `sem_config` — é ele que limpa o que JÁ está na fila nos deploys existentes, e ele
-- também cobre a janela em que alguém desliga o webhook com eventos já enfileirados.

create or replace function public.enfileirar_evento(p_tipo text, p_ws uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Sem destino, não há o que enfileirar. `ativo` faz parte da condição: desligar o webhook
  -- na tela tem que parar de acumular, não só parar de entregar.
  if not exists (
    select 1 from public.webhook_config c
    where c.workspace_id = p_ws and c.ativo
  ) then
    return;
  end if;

  insert into public.eventos_webhook (workspace_id, tipo, payload) values (p_ws, p_tipo, p_payload);
end $$;
revoke all on function public.enfileirar_evento(text, uuid, jsonb) from public, anon;

-- ═══ DÍVIDA 2 · A IA NUNCA SOUBE QUE UM REGISTRO SUMIU ════════════════════════
--
-- As 4 triggers da `0007` são `after insert` e `after update`. Desde que a exclusão de
-- contato/empresa/negócio/atividade nasceu (v0.4.0), um registro podia desaparecer do CRM sem
-- que nada avisasse a integração — que seguiria com uma cópia de um negócio que não existe
-- mais, e cujo `upsert` por `chave_externa` o RECRIARIA na primeira sincronização.
--
-- Os dois eventos abaixo fecham isso. Eles carregam `chave_externa` porque é por ela que a
-- integração identifica o registro do lado dela — sem a chave, o consumidor recebe um id
-- interno que ele pode nunca ter visto.
--
-- ⚠️ Só CONTATO e NEGÓCIO ganham evento, porque só eles têm evento de criação (`lead_novo`,
-- `deal_novo`). Empresa e atividade nunca entraram no contrato de egress; anunciar a morte de
-- algo cujo nascimento nunca foi anunciado daria ao consumidor um evento órfão.
--
-- ⚠️ Exclusão em CASCATA não gera evento próprio: apagar um negócio leva as atividades dele
-- junto pela FK, e nenhuma trigger dispara para elas. É consistente com o de cima (atividade
-- não tem evento de criação) e evita que um clique vire uma rajada de eventos.

create or replace function public.trg_contato_excluido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enfileirar_evento('lead_excluido', old.workspace_id, jsonb_build_object(
    'contato', jsonb_build_object('id', old.id, 'nome', old.nome, 'email', old.email,
      'chave_externa', old.chave_externa)));
  return null;
end $$;
create trigger contatos_excluido after delete on public.contatos
  for each row execute function public.trg_contato_excluido();

create or replace function public.trg_negocio_excluido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enfileirar_evento('deal_excluido', old.workspace_id, jsonb_build_object(
    'negocio', jsonb_build_object('id', old.id, 'titulo', old.titulo, 'valor', old.valor,
      'status', old.status, 'pipeline_id', old.pipeline_id, 'etapa_id', old.etapa_id,
      'chave_externa', old.chave_externa)));
  return null;
end $$;
create trigger negocios_excluido after delete on public.negocios
  for each row execute function public.trg_negocio_excluido();
