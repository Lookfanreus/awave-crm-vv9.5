-- 0018_marca_bucket.sql — o bucket onde o logo e o favicon do comprador vivem.
--
-- A marca ("Awave CRM", o tile do rail, o favicon) estava fixa no código. Trocá-la exigia
-- editar arquivos do produto, que a atualização em 1 clique substitui — ou seja, não existia
-- white-label que sobrevivesse ao update, e é isso que trava revenda.
--
-- ESCOPO É O DEPLOY, não o workspace (decisão do dono, 2026-08-11). A tela de LOGIN, o favicon
-- e o título da aba renderizam ANTES de existir workspace — e o login é a primeira coisa que o
-- cliente do revendedor vê. Por-workspace deixaria a nossa marca exatamente na porta de
-- entrada, que é o caso que motivou o pedido. Os valores vivem em `settings`, que já é a
-- tabela de estado do DEPLOY (vizinha do `dono_deploy_user_id`).
--
-- == POR QUE ESTA MIGRATION NÃO CRIA POLÍTICA NENHUMA =========================
--
-- 🔴 Isto é deliberado, e é o que impede a migration de derrubar o boot de todo comprador.
--
-- `create policy ... on storage.objects` exige ser DONO da tabela. O `storage.objects` é da
-- extensão de Storage do Supabase, e o papel da nossa connection string pode não ter esse
-- direito — o erro é `must be owner of table objects`. Uma migration que falha não é um
-- recurso ausente: o container NÃO SOBE, em toda instalação, e o comprador fica sem CRM
-- nenhum por causa de um logo.
--
-- E não é preciso, porque as duas pontas já estão resolvidas por outro caminho:
--   * LEITURA: o bucket é `public = true`. Objeto de bucket público é servido pela URL
--     pública sem passar por RLS — que é exatamente o que a tela de login (anônima) precisa.
--   * ESCRITA: só as nossas server actions escrevem, pelo cliente `admin()` (service_role),
--     que BYPASSA RLS. E elas já checam `ehDonoDoDeploy()` antes.
--
-- == POR QUE UM BUCKET PRÓPRIO, E NÃO UM GENÉRICO =============================
--
-- ⚠️ A fatia de "anexar proposta em PDF" vai precisar de Storage também, e a tentação de
-- reusar este bucket é real. NÃO REUSE: as políticas são OPOSTAS. Logo é público por
-- necessidade (login anônimo); proposta comercial é documento de cliente, privado e por
-- workspace. Um anexo num bucket público é vazamento com URL adivinhável.
--
-- Aditivo/expand-only. `on conflict do nothing` porque o boot reaplica migrations pendentes e
-- um deploy que já tenha o bucket não pode falhar por isso.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marca',
  'marca',
  true,
  -- 1 MB. Um logo de topo de menu cabe folgado em muito menos; o teto existe pra impedir que
  -- alguém suba um PNG de 8 MB e faça TODA tela do produto (o rail está no layout) carregar
  -- isso. O limite do bucket é a última barreira — a action valida antes, com mensagem.
  1048576,
  -- Sem `image/svg+xml`: SVG é documento, não imagem. Ele carrega script e é servido do NOSSO
  -- domínio a partir de um bucket público — um SVG hostil aberto direto pela URL executa com a
  -- origem do CRM. Os três formatos abaixo cobrem qualquer logo real.
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
