-- 0021_policies_leitura.sql — o token do usuario perde a ESCRITA, nas duas superficies que
-- ele alcanca: as policies de membro passam a ser SO DE LEITURA, e a funcao que escreve sem
-- consultar policy nenhuma para de ser executavel por ele (no fim do arquivo).
--
-- Por que: o cliente Supabase que roda no navegador usa o MESMO token do usuario que o
-- servidor usa ao agir em nome dele. No PostgREST as duas coisas sao indistinguiveis, entao
-- uma policy `for all` que autoriza a escrita do servidor autoriza tambem uma escrita
-- disparada do console do navegador — pulando a validacao das server actions e a checagem
-- de licenca, que sao server-side. Enquanto nenhuma tela tinha cliente Supabase isso era
-- inofensivo; ao ligar o Realtime deixa de ser.
--
-- As escritas ja foram movidas para o cliente service-role, no servidor (commits anteriores
-- desta branch). O isolamento por workspace passa a depender do filtro explicito do codigo,
-- conferido por uma barreira automatizada na suite de testes.
--
-- Aditiva no sentido que importa aqui: nao apaga linha, nao altera coluna, nao muda tipo. O
-- rollback e recriar a policy anterior, cujo texto esta citado em cada bloco.
--
-- A leitura NAO muda: mesmo predicado, mesmo alcance. Quem enxergava, enxerga.

-- == as seis do nucleo (nasceram em 0005) ==================================
-- antes: for all to authenticated using (e_membro) with check (e_membro)
drop policy if exists empresas_membro on public.empresas;
create policy empresas_membro on public.empresas for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists contatos_membro on public.contatos;
create policy contatos_membro on public.contatos for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists pipelines_membro on public.pipelines;
create policy pipelines_membro on public.pipelines for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists etapas_membro on public.etapas;
create policy etapas_membro on public.etapas for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists negocios_membro on public.negocios;
create policy negocios_membro on public.negocios for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists atividades_membro on public.atividades;
create policy atividades_membro on public.atividades for select to authenticated using (public.e_membro(workspace_id));

-- == convites: o predicado e `e_owner`, e continua sendo ===================
-- antes: for all to authenticated using (e_owner) with check (e_owner)
drop policy if exists convites_all on public.convites;
create policy convites_all on public.convites for select to authenticated using (public.e_owner(workspace_id));

-- == as demais, uma por migration de origem ================================
-- antes (todas): for all to authenticated using (e_membro) with check (e_membro)
drop policy if exists credenciais_api_membro on public.credenciais_api;
create policy credenciais_api_membro on public.credenciais_api for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists webhook_config_membro on public.webhook_config;
create policy webhook_config_membro on public.webhook_config for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists tipos_atividade_membro on public.tipos_atividade;
create policy tipos_atividade_membro on public.tipos_atividade for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists campos_def_membro on public.campos_def;
create policy campos_def_membro on public.campos_def for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists campos_etapa_membro on public.campos_etapa;
create policy campos_etapa_membro on public.campos_etapa for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists automacoes_membro on public.automacoes;
create policy automacoes_membro on public.automacoes for select to authenticated using (public.e_membro(workspace_id));

drop policy if exists relatorios_membro on public.relatorios;
create policy relatorios_membro on public.relatorios for select to authenticated using (public.e_membro(workspace_id));

-- == tres policies de ESCRITA que ja nasceram orfas ========================
-- `workspaces_upd`, `workspaces_del` e `membros_del` autorizam UPDATE/DELETE ao dono do
-- workspace, pelo token dele. Nenhum caminho do servidor as usa, e nunca usou: nao existe
-- tela de renomear ou apagar workspace, nem de remover membro, e as unicas escritas nessas
-- duas tabelas saem de funcoes `security definer` (`criar_workspace`, `aceitar_convite`),
-- que rodam como dona do objeto e nao consultam policy nenhuma.
--
-- Aqui o `drop` NAO tem par, e isso e de proposito: `workspaces_sel` e `membros_sel` ja
-- existem em separado desde a 0005 e continuam intactas. A leitura nao muda; recriar estas
-- tres como `for select` so acrescentaria uma segunda policy de leitura, redundante.
--
-- Sao as de maior alcance do arquivo: um `delete` em `workspaces` disparado do navegador
-- leva junto, por cascata, todo o dado que pende do workspace.
-- antes: for update to authenticated using (e_owner(id)) with check (e_owner(id))
drop policy if exists workspaces_upd on public.workspaces;
-- antes: for delete to authenticated using (e_owner(id))
drop policy if exists workspaces_del on public.workspaces;
-- antes: for delete to authenticated using (e_owner(workspace_id))
drop policy if exists membros_del on public.membros;

-- == a outra superficie: quem pode EXECUTAR a funcao =======================
-- Rebaixar policy nao alcanca funcao `security definer`. Ela roda como DONA do objeto: a RLS
-- nao e avaliada e policy nenhuma e consultada. O unico controle entre o token do navegador e
-- o corpo dela e o `grant execute`. Varrer so as policies deixaria essa metade intacta.
--
-- `criar_workspace` grava workspace, membro, funil e as cinco etapas de uma vez, e recebe o
-- dono por PARAMETRO. Enquanto `authenticated` pudesse executa-la, um `rpc()` disparado do
-- console do navegador criava workspace em serie, e com um dono arbitrario plantava um
-- workspace do qual OUTRA pessoa nasce `owner` — sem passar por server action nenhuma e sem
-- a checagem de licenca, que e server-side. Os dois caminhos do produto que a chamam ja usam
-- o cliente de service-role, entao o grant a `authenticated` nao servia mais a ninguem.
--
-- `aceitar_convite` FICA como esta, e a diferenca e mecanica: o corpo dela le `auth.uid()` e
-- recusa quando e nulo. Sob service-role seria sempre nulo e todo aceite quebraria. Ela
-- PRECISA da sessao; a outra so a recebia.
--
-- Cuidado ao mexer: no Supabase o `alter default privileges` concede EXECUTE a
-- `authenticated` na CRIACAO da funcao (e o motivo de a 0008 existir), entao `revoke ... from
-- public, anon` nao tira esse grant — o revoke tem que NOMEAR `authenticated`.
--
-- Rollback: `grant execute on function public.criar_workspace(text, uuid) to authenticated;`
revoke execute on function public.criar_workspace(text, uuid) from authenticated;
