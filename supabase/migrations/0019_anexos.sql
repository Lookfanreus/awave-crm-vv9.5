-- 0019_anexos.sql — arquivos anexados a um negócio (proposta em PDF, print, contrato).
--
-- Pedido de comprador: "anexar proposta em pdf" no negócio. Até aqui o CRM não guardava
-- arquivo nenhum de cliente — a proposta vivia no e-mail, e o negócio no CRM não tinha como
-- apontar pra ela.
--
-- == 🔴 BUCKET PRÓPRIO E PRIVADO — O OPOSTO DO `marca` ========================
--
-- A `0018` já tinha escrito o aviso, e ele vale literalmente: **não reuse o bucket `marca`.**
-- As políticas são OPOSTAS. Logo é público por necessidade (a tela de LOGIN é anônima e
-- precisa exibi-lo); proposta comercial é documento de cliente. Um anexo num bucket público é
-- vazamento com URL adivinhável — e adivinhável de verdade, porque o caminho carrega ids.
--
--   `public = false` ⇒ a URL pública não serve nada. A leitura sai por **URL ASSINADA**,
--   gerada no servidor pelo `admin()` depois de conferir a sessão e o workspace
--   (`src/server/crm/anexos.ts`). O link expira; ele não é um endereço permanente.
--
-- == POR QUE ESTA MIGRATION TAMBÉM NÃO CRIA POLÍTICA EM `storage.objects` ======
--
-- Mesmo motivo da `0018`, e ele não mudou: `create policy ... on storage.objects` exige ser
-- DONO da tabela, o papel da nossa connection string pode não ter esse direito, e migration
-- que falha não é recurso ausente — é **container que não sobe**, em toda instalação.
--
-- Aqui isso é ainda menos custoso que na `0018`, porque o bucket é privado: sem política,
-- `anon` e `authenticated` não leem NADA dele. O único caminho é o `admin()` (service_role,
-- que bypassa RLS), e ele só entrega URL assinada depois de validar sessão + workspace. A
-- ausência de política é fail-CLOSED, não fail-open.
--
-- Aditivo/expand-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anexos',
  'anexos',
  false,
  -- 10 MB. Proposta em PDF com imagem cabe folgado; o teto existe pra impedir que o Storage do
  -- comprador vire depósito de vídeo. A action valida antes, com mensagem em português — este
  -- limite é a última barreira, e o erro dela é técnico.
  10485760,
  -- 🔴 Sem `image/svg+xml` e sem `text/html`, pela mesma razão da `0018`: os dois são
  -- documentos que carregam script. O bucket ser privado reduz o estrago (o arquivo sai por
  -- URL assinada, no domínio do Supabase, não no nosso), mas "menor estrago" não é motivo pra
  -- aceitar executável disfarçado de anexo.
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- == a tabela ==============================================================
create table if not exists public.anexos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  -- Caminho DENTRO do bucket: `<workspace_id>/<negocio_id>/<uuid>.<ext>`. O prefixo de
  -- workspace não é enfeite: ele torna óbvio, na inspeção do bucket, a que tenant um objeto
  -- pertence, e é o que permitiria criar política por prefixo no futuro sem migrar arquivo.
  caminho text not null unique,
  -- O nome que a PESSOA vê e baixa, preservado como veio (só higienizado). O caminho é
  -- opaco de propósito — nome de arquivo de cliente não deve virar parte de URL.
  nome text not null,
  tamanho bigint not null,
  tipo text not null,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists anexos_negocio_idx on public.anexos (workspace_id, negocio_id, criado_em desc);

alter table public.anexos enable row level security;

-- Par de políticas do repo (molde da 0006/0007): service_role total + membro do workspace.
create policy anexos_service_role on public.anexos
  for all to service_role using (true) with check (true);
create policy anexos_membro on public.anexos
  for all to authenticated
  using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
