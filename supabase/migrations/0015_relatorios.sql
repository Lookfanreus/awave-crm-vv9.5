-- 0015_relatorios.sql — relatorio SALVO: guarda a pergunta, nao o resultado.
-- Aditiva: 1 tabela nova. Nada existente muda.
--
-- Guardamos a PERGUNTA (tipo + filtros + periodo + agrupamento), nunca as linhas
-- calculadas: relatorio e uma consulta que reabre sobre o dado de HOJE. Materializar o
-- resultado criaria um segundo lugar onde o numero vive e envelhece — o comprador abriria
-- "Conversao Q3" em setembro e leria o retrato de julho sem saber.
--
-- O numero da migration pula o 0014: essa faixa esta reservada. O runner (migrate.mjs)
-- ordena e aplica so as pendentes, entao buraco de numeracao e inofensivo — colisao e que
-- nao seria.

create table public.relatorios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null,
  -- SEM 'produtividade' no check: ele depende de `autor_membro_id`, que ainda nao existe, e
  -- entra depois por `alter ... drop constraint ... add constraint` (aditivo). Listar agora
  -- um tipo que ninguem calcula convida a gravar lixo que a UI nao sabe abrir.
  tipo text not null check (tipo in ('funil_conversao','tempo_por_etapa','forecast','tabela')),
  config jsonb not null default '{}',
  -- `set null` (nao cascade): o relatorio e do WORKSPACE, nao da pessoa. Membro que sai
  -- nao pode levar embora a pergunta que o time usa toda semana.
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Padrao de tenancy do repo (0011/0013): alvo de FK composta futura, garantindo que
  -- qualquer referencia carregue o workspace junto e nao consiga cruzar tenant.
  unique (workspace_id, id)
);
create trigger relatorios_set_atualizado before update on public.relatorios
  for each row execute function public.set_atualizado_em();
-- Serve a lista de /relatorios (mais recentes primeiro), ja filtrada por workspace.
create index relatorios_ws_idx on public.relatorios (workspace_id, criado_em desc);

-- == RLS par (service_role + membro), padrao 0006/0009/0011/0013 ===========
-- Membro tem `for all`: relatorio e criado/editado/excluido PELA UI, ao contrario do
-- historico (0012) e do log de execucao (0013), que sao escritos por trigger/motor.
alter table public.relatorios enable row level security;
create policy relatorios_service_role on public.relatorios for all to service_role
  using (true) with check (true);
create policy relatorios_membro on public.relatorios for all to authenticated
  using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
