-- 0017_negociacao_cedilha.sql — a etapa padrão nascia "Negociacao", sem cedilha.
--
-- O TypeScript sempre esteve certo: `src/server/crm/funis.ts` (ETAPAS_PADRAO, usado quando
-- alguém cria um funil pela UI) tem 'Negociação'. Quem estava errado é quem de fato semeia o
-- funil do PRIMEIRO workspace — o RPC `criar_workspace` —, e a mesma string errada aparece em
-- três migrations já rodadas:
--
--   0003_seed_pipeline_padrao.sql:14
--   0005_rls_rpcs.sql:53          (dentro do criar_workspace)
--   0009_atividades_agenda.sql:91 (idem, a versão vigente)
--
-- Consequência: TODO workspace criado até aqui, em TODO deploy de comprador, nasceu com uma
-- etapa escrita errado no idioma do produto. Não dá pra consertar editando aquelas migrations
-- — migration é imutável e já rodou.
--
-- ── Parte 1: a função, pra parar a sangria ────────────────────────────────────────────────
-- `create or replace` de FUNÇÃO é aditivo (não toca dado, não toca schema), então cabe no
-- expand-only. Cópia fiel do corpo da 0009 com UMA letra trocada; se aquele corpo mudar de
-- novo, esta é a versão que vale, porque é a última a rodar.
create or replace function public.criar_workspace(nome text, p_dono uuid default auth.uid())
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ws uuid; v_pipe uuid;
begin
  if p_dono is null then raise exception 'dono ausente'; end if;
  insert into public.workspaces (nome, dono_id) values (nome, p_dono) returning id into v_ws;
  insert into public.membros (workspace_id, user_id, papel) values (v_ws, p_dono, 'owner');
  insert into public.pipelines (workspace_id, nome, ordem, is_padrao)
    values (v_ws, 'Funil de vendas', 0, true) returning id into v_pipe;
  insert into public.etapas (workspace_id, pipeline_id, nome, ordem, cor)
  select v_ws, v_pipe, e.nome, e.ordem, e.cor from (values
    ('Novo lead', 0, '#94a3b8'), ('Contato feito', 1, '#60a5fa'),
    ('Proposta', 2, '#a78bfa'), ('Negociação', 3, '#fbbf24'),
    ('Fechamento', 4, '#34d399')
  ) as e(nome, ordem, cor);
  insert into public.tipos_atividade (workspace_id, slug, nome, icone, natureza, ordem, bloqueado)
  select v_ws, d.slug, d.nome, d.icone, d.natureza, d.ordem, d.bloqueado from (values
    ('ligacao','Ligação','Phone','atividade',0,false),
    ('reuniao','Reunião','Users','atividade',1,false),
    ('tarefa','Tarefa','CircleCheck','atividade',2,false),
    ('email','E-mail','Mail','atividade',3,false),
    ('prazo','Prazo','Flag','atividade',4,false),
    ('nota','Nota','StickyNote','nota',5,true),
    ('etapa_mudou','Etapa mudou','ArrowRight','sistema',6,true),
    ('resumo_ia','Resumo IA','Sparkles','sistema',7,true)
  ) as d(slug,nome,icone,natureza,ordem,bloqueado);
  return v_ws;
end $$;

-- ── Parte 2: as linhas já gravadas ────────────────────────────────────────────────────────
--
-- 🔴 O GUARDA É A IGUALDADE EXATA, e ele é o ponto todo desta parte.
--
-- `src/lib/cores-etapa.ts` registra a regra da casa: reescrever dado do comprador em silêncio
-- apaga uma escolha que pode ter sido dele. Aqui a escolha não existe — 'Negociacao' é
-- literalmente a string que NÓS gravamos, com o erro que NÓS cometemos. Quem renomeou a etapa
-- tem qualquer outro nome e não é tocado; quem manteve o padrão recebe o padrão escrito certo.
--
-- Não uso `like` nem `unaccent`: os dois pegariam 'Negociação' (já certa, virando escrita
-- desnecessária) e qualquer variação que o comprador tenha digitado à mão. Igualdade exata
-- toca só o que veio do seed.
--
-- Sem risco de colisão: `etapas` não tem unique em (pipeline_id, nome) — as únicas são
-- (pipeline_id, id) e (workspace_id, id). Um funil com as duas grafias termina com duas etapas
-- 'Negociação', que é o mesmo estado que teria se a pessoa tivesse renomeado à mão.
--
-- Idempotente por construção: rodar de novo casa zero linhas.
--
-- ⚠️ Se alguém QUERIA a grafia sem cedilha, ela volta em dois cliques no /config/funis. O
-- inverso não é verdade: sem esta migration, a grafia errada não sai nunca de deploy nenhum.
update public.etapas
   set nome = 'Negociação'
 where nome = 'Negociacao';
