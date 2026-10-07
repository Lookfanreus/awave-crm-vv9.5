-- 0010_tipos_ativo.sql — Atividades·C: soft-archive de tipos de atividade.
-- Aditivo/expand-only. `ativo=false` esconde o tipo dos seletores de UI mas preserva o
-- histórico (a FK atividades_tipo_fk é ON DELETE RESTRICT — banco recusa dropar tipo em uso).
-- Os 8 tipos semeados (0009) herdam o default `true`; `criar_workspace` não precisa mudar.
alter table public.tipos_atividade
  add column ativo boolean not null default true;
