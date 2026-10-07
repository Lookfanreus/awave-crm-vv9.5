-- 0011_campos_customizados.sql — campos criados pelo usuario: catalogo + valores em JSONB.
-- Aditivo/expand-only. Modelo: JSONB + catalogo, chave do JSONB = slug IMUTAVEL (molde:
-- tipos_atividade, 0009). RLS par + FK compostas, como 0006/0009.

-- == alvos das FKs COMPOSTAS (padrao 0004:21 / 0009:17) — ANTES de quem referencia ==
-- `negocios` entra AQUI (nao numa migration futura) porque 0012/0013 ja precisam referenciar
-- negocio por (workspace_id, id). Uma FK so por `id` deixaria um workspace apontar para o
-- registro de outro.
alter table public.pipelines add constraint pipelines_ws_id_key unique (workspace_id, id);
alter table public.etapas    add constraint etapas_ws_id_key    unique (workspace_id, id);
alter table public.negocios  add constraint negocios_ws_id_key  unique (workspace_id, id);

-- == catalogo ==============================================================
create table public.campos_def (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pipeline_id uuid,                 -- null = campo do workspace inteiro
  entidade text not null check (entidade in ('negocio','contato','empresa')),
  slug text not null,               -- IDENTIDADE: nao muda no rename (e a chave do JSONB)
  rotulo text not null,
  tipo text not null check (tipo in (
    'texto','texto_longo','numero','moeda','data','selecao_unica','selecao_multipla',
    'checkbox','email','telefone','documento','responsavel',
    'conexao_contato','conexao_empresa','conexao_negocio')),
  opcoes jsonb not null default '[]',   -- [{id, rotulo, cor?, arquivada?}] p/ selecao_*
  config jsonb not null default '{}',   -- {casas?, ajuda?}
  ordem int not null default 0,
  ativo boolean not null default true,  -- soft-archive (molde: tipos_atividade.ativo, 0010)
  criado_em timestamptz not null default now(),
  -- slug unico POR ENTIDADE: negocio/contato/empresa gravam em colunas `campos` distintas,
  -- entao 'observacoes' pode existir nos tres sem colidir.
  unique (workspace_id, entidade, slug),
  unique (workspace_id, id),            -- alvo da FK composta de campos_etapa
  foreign key (workspace_id, pipeline_id) references public.pipelines (workspace_id, id) on delete cascade
);
create index campos_def_ws_idx on public.campos_def (workspace_id, entidade, ordem);

-- == obrigatoriedade / visibilidade por etapa ==============================
-- `obrigatorio` = obrigatorio para SAIR da etapa. Aqui a regra so se CONFIGURA; quem barra o
-- avanco do negocio e a aplicacao.
-- FKs com NOME EXPLICITO (padrao 0009: atividades_tipo_fk): o embed do PostgREST cita a
-- constraint pelo nome (`campos_def!campos_etapa_campo_fk(...)`), entao depender do nome
-- auto-gerado pelo Postgres seria fragil.
create table public.campos_etapa (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campo_id uuid not null,
  etapa_id uuid not null,
  obrigatorio boolean not null default false,
  visivel boolean not null default true,
  primary key (campo_id, etapa_id),
  constraint campos_etapa_campo_fk foreign key (workspace_id, campo_id)
    references public.campos_def (workspace_id, id) on delete cascade,
  constraint campos_etapa_etapa_fk foreign key (workspace_id, etapa_id)
    references public.etapas (workspace_id, id) on delete cascade
);
create index campos_etapa_etapa_idx on public.campos_etapa (workspace_id, etapa_id);

-- == valores: JSONB por entidade ===========================================
-- default '{}' -> seguro em tabela COM linhas (expand-only). O CHECK garante objeto.
alter table public.negocios add column campos jsonb not null default '{}'
  constraint negocios_campos_obj check (jsonb_typeof(campos) = 'object');
alter table public.contatos add column campos jsonb not null default '{}'
  constraint contatos_campos_obj check (jsonb_typeof(campos) = 'object');
alter table public.empresas add column campos jsonb not null default '{}'
  constraint empresas_campos_obj check (jsonb_typeof(campos) = 'object');

-- GIN jsonb_path_ops: cobre containment/igualdade (@>), o filtro comum (selecao, checkbox,
-- responsavel, conexao). Ordenacao/faixa em campo quente = indice de expressao, quando doer.
create index negocios_campos_gin on public.negocios using gin (campos jsonb_path_ops);
create index contatos_campos_gin on public.contatos using gin (campos jsonb_path_ops);
create index empresas_campos_gin on public.empresas using gin (campos jsonb_path_ops);

-- == RLS par (service_role + membro), padrao 0006/0009 =====================
alter table public.campos_def   enable row level security;
alter table public.campos_etapa enable row level security;
create policy campos_def_service_role on public.campos_def
  for all to service_role using (true) with check (true);
create policy campos_def_membro on public.campos_def
  for all to authenticated
  using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
create policy campos_etapa_service_role on public.campos_etapa
  for all to service_role using (true) with check (true);
create policy campos_etapa_membro on public.campos_etapa
  for all to authenticated
  using (public.e_membro(workspace_id)) with check (public.e_membro(workspace_id));
