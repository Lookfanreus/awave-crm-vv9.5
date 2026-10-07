-- 0060_escritas_de_authenticated.sql — tira do papel `authenticated` (o token que o NAVEGADOR
-- carrega) a escrita que ele alcançava sem passar pelo servidor, em duas superfícies: as três
-- policies órfãs de `workspaces`/`membros`, e a escolha do DONO dentro da `criar_workspace`.
--
-- ═══ 🔴 ESTE ARQUIVO FOI REESCRITO DEPOIS DE MERGEADO, E ISSO PEDE JUSTIFICATIVA ═══════════
--
-- A regra da casa é que migration é IMUTÁVEL. A exceção aqui é estreita e foi MEDIDA, não
-- suposta: esta migration nunca rodou em banco nenhum e nunca foi entregue a ninguém.
--
--   · `git tag --contains` do commit que a trouxe: VAZIO — nenhuma release a carrega.
--   · `awave_migrations` do banco de desenvolvimento: a versão mais alta é `0041`, da outra
--     frente. `0060` não está lá.
--
-- A primeira redação revogava `criar_workspace` de `authenticated`. Essa linha era um defeito,
-- e o parágrafo seguinte é o motivo inteiro deste arquivo existir na forma que tem.
--
-- ═══ 🔴 POR QUE O `REVOKE` ERA O INSTRUMENTO ERRADO ═══════════════════════════════════════
--
-- Revogar fechava a porta certa e cobrava um preço que só aparecia depois: ele quebra a
-- RELEASE ANTERIOR. A `v0.7.1` chama `criar_workspace` pelo cliente de SESSÃO, na tela de
-- primeiro espaço de trabalho.
--
-- O Desfazer da atualização em 1 clique volta o CÓDIGO e NÃO volta o banco. Logo:
--
--   o comprador atualiza (o banco roda esta migration) → algo quebra → ele clica em Desfazer →
--   o código volta para a `v0.7.1` → o banco continua com a revogação → quem ainda não tem
--   espaço de trabalho vê "Não foi possível criar o workspace" e NÃO TEM OUTRA PORTA.
--
-- A saída era uma linha de SQL no editor do Supabase — escrita na migration, no CHANGELOG e no
-- guia, ou seja, em três lugares que a pessoa TRANCADA não alcança de dentro do produto. Isso
-- não é um detalhe de documentação: é um estado em que o produto se fecha e a instrução para
-- reabri-lo mora do lado de dentro.
--
-- ⚠️ A regra que fica: "migration aditiva" não é só sobre FORMA e DADO. Uma migration que
-- retira PRIVILÉGIO também quebra o código anterior — só que em runtime, na cara de um
-- usuário, e sem nada no boot acusando. O gate de expand-only guarda a primeira metade — a
-- que fala de forma e de dado; a segunda é esta.
--
-- ═══ O QUE FECHA A PORTA SEM QUEBRAR O CAMINHO DE VOLTA ═══════════════════════════════════
--
-- O perigo nunca foi a sessão EXECUTAR a função — foi ela poder ESCOLHER O DONO.
-- `criar_workspace` é `security definer` (roda como dona do objeto, policy nenhuma é
-- consultada) e recebia `p_dono` por parâmetro: um `rpc()` do console plantava um espaço de
-- trabalho do qual OUTRA pessoa nasce `owner`.
--
-- Então o parâmetro deixa de ser escolha: havendo sessão, o dono é quem está logado. A função
-- passa a se autorizar sozinha — que é exatamente o critério pelo qual `aceitar_convite`
-- sempre pôde ficar executável pela sessão, e o critério que `criar_workspace` não cumpria.
--
-- ⚠️ MEDIDO CONTRA O BANCO, não lido — e a medição tem DUAS metades, porque o `coalesce` só
-- funciona se as duas valerem:
--
--   · sob o cliente de SERVIÇO, `auth.uid()` é NULO. Chamando `criar_workspace` como
--     service-role sem `p_dono`, o banco de desenvolvimento respondeu `P0001 dono ausente`.
--     É o que mantém os dois chamadores do produto (`registrar.ts` e a tela de 1º espaço)
--     funcionando, e é por isso que eles passam `p_dono` explícito.
--   · sob a SESSÃO, dentro de uma `security definer`, `auth.uid()` é o usuário logado. Medido
--     na `e_membro(uuid)`, que tem exatamente a mesma forma: com o JWT de um usuário ela
--     devolveu `true` para um espaço de trabalho dele, e `false` para o MESMO espaço sob
--     service-role. A segunda metade é a que faz a guarda guardar.
--
-- O QUE ISTO **NÃO** FECHA, e dizer o contrário faria a próxima pessoa confiar num limite que
-- não existe: criar espaço de trabalho EM SÉRIE. Não há teto — nem aqui, nem na server action,
-- que também não confere se você já tem um. O que saiu do alcance foi escolher o DONO.
--
-- ═══ ISTO É "ADITIVO"? ════════════════════════════════════════════════════════════════════
--
-- Sim, e a distinção importa. Nenhuma tabela, coluna, índice ou linha é tocada. `create or
-- replace` de função já é o instrumento aditivo da casa (a `0009` e a `0017` recriaram esta
-- mesma função). O que muda além disso é PERMISSÃO — e, ao contrário da primeira redação, muda
-- no sentido que NÃO quebra a versão anterior.
--
-- ═══ 🔴 POR QUE `0060` E NÃO `0033` ═══════════════════════════════════════════════════════
--
-- A migration mais alta desta árvore é a `0032`, e o vão de `0021` a `0031` PARECE livre. Não
-- está: outra frente de desenvolvimento, ainda não integrada, ocupa `0021` até `0053` inteiro.
-- Reaproveitar qualquer número desse vão seria o pior caso possível —
--
--   o `migrate.mjs` registra e compara por VERSÃO (os quatro dígitos iniciais do nome), nunca
--   pelo nome do arquivo. Aplicada uma `0033_x.sql`, uma `0033_y.sql` que chegue depois é
--   tratada como JÁ APLICADA: ela não roda, não avisa, e o boot fica verde. O estrago só
--   aparece muito depois, em tempo de execução, como um objeto que "não existe".
--
-- `0060` fica acima daquela faixa COM FOLGA, para a outra frente continuar crescendo até a
-- `0059` sem colidir com esta.
--
-- Quando as duas árvores virarem uma, as migrations de lá terão número ABAIXO desta. Isso é
-- esperado e não quebra nada: o `migrate.mjs` SINALIZA migration fora de ordem (um aviso no
-- log do boot) e segue aplicando — ele nunca recusa. E é por isso que o `grant` do fim deste
-- arquivo é ESCRITO EXPLICITAMENTE em vez de "deixado como está": a outra frente revoga a
-- mesma função na `0021` dela, e num banco que já rodou aquela linha é este `grant` que
-- devolve o caminho da tela de primeiro espaço de trabalho.

-- ═══ PARTE 1: as três policies de escrita que nasceram sem dono ═══════════════════════════
--
-- A `0005_rls_rpcs.sql` criou, junto com as policies de leitura, três policies de escrita para
-- o usuário logado:
--
--   · `workspaces_upd`  — update em `workspaces`, se você for owner dele
--   · `workspaces_del`  — delete em `workspaces`, idem
--   · `membros_del`     — delete em `membros`, idem
--
-- Nenhum caminho do servidor usa as três, e nunca usou. Não existe tela de renomear nem de
-- apagar espaço de trabalho, nem de remover membro. O efeito delas era um só: o token do
-- NAVEGADOR — o mesmo que a tela usa para ler — podia apagar linhas de `membros` e de
-- `workspaces` direto do console, sem passar por ação de servidor, validação ou registro. Não
-- há travessia entre espaços de trabalho (o `using` prende ao owner daquele espaço), mas é
-- escrita fora de qualquer guarda: dava para deixar o próprio espaço sem membro nenhum.
--
-- ⚠️ Derrubar as três NÃO quebra a release anterior — e é a diferença entre esta parte e a que
-- foi reescrita. Nenhuma versão do produto jamais as exercitou; a busca por chamador foi feita
-- no `src/` inteiro. Privilégio que código nenhum usa se retira sem custo; privilégio que a
-- versão anterior USA, não.
--
-- O rollback cabe em três linhas e está escrito aqui, verbatim, para não depender de arqueologia:
--
--   create policy workspaces_upd on public.workspaces for update to authenticated
--     using (public.e_owner(id)) with check (public.e_owner(id));
--   create policy workspaces_del on public.workspaces for delete to authenticated
--     using (public.e_owner(id));
--   create policy membros_del on public.membros for delete to authenticated
--     using (public.e_owner(workspace_id));
--
-- O `if exists` não é zelo: a outra frente derruba estas MESMAS três, também com `if exists`.
-- Com ele nos dois lados as duas migrations são idempotentes entre si — a que rodar por último
-- é no-op, em vez de abortar a transação do boot em toda instalação que já rodou a primeira.

drop policy if exists workspaces_upd on public.workspaces;
drop policy if exists workspaces_del on public.workspaces;
drop policy if exists membros_del    on public.membros;

-- A leitura NÃO é tocada: `workspaces_sel` e `membros_sel` (as duas da `0005`) continuam de
-- pé. Sem elas a tela do usuário logado para de enxergar o próprio espaço de trabalho.

-- ═══ PARTE 2: `criar_workspace` deixa de aceitar um dono escolhido pela sessão ═════════════
--
-- Corpo idêntico ao da `0017` (que é a versão vigente), com UMA mudança de comportamento: o
-- dono passa a sair de `v_dono`, e `v_dono` prefere `auth.uid()` ao parâmetro.
--
--   · pela SESSÃO   → `auth.uid()` é o usuário logado, e `p_dono` é ignorado. Forjar o dono
--                     deixa de ser possível, venha a chamada da tela ou do console.
--   · pelo SERVIÇO  → `auth.uid()` é nulo (medido), então `p_dono` vale. É o que os dois
--                     chamadores do produto usam, e o que o `admin()` da tela precisa.
--
-- 🔴 `p_dono` NÃO PODE VOLTAR A APARECER DEPOIS DESTA LINHA. Um `insert … values (v_ws,
-- p_dono, 'owner')` que sobrevivesse a uma edição futura devolveria a escolha do dono a quem
-- chama, em silêncio, com o `coalesce` ainda no arquivo parecendo que guarda alguma coisa. Há
-- barreira de disco contra isso na suíte do produto.
--
-- O `nome` vazio passa a ser recusado aqui também: a server action já aparava e recusava, e a
-- porta do PostgREST não. Duas portas para o mesmo insert precisam da mesma regra, senão a
-- validação é só uma sugestão da tela.
create or replace function public.criar_workspace(nome text, p_dono uuid default auth.uid())
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ws uuid; v_pipe uuid; v_dono uuid; v_nome text;
begin
  v_dono := coalesce(auth.uid(), p_dono);
  if v_dono is null then raise exception 'dono ausente'; end if;
  v_nome := btrim(coalesce(nome, ''));
  if v_nome = '' then raise exception 'nome vazio'; end if;
  insert into public.workspaces (nome, dono_id) values (v_nome, v_dono) returning id into v_ws;
  insert into public.membros (workspace_id, user_id, papel) values (v_ws, v_dono, 'owner');
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

-- ⚠️ A LISTA DE TIPOS TEM QUE SER EXATA. `grant`/`revoke` com assinatura errada não dá erro:
-- é NO-OP SILENCIOSO, e o gate offline fica inteiro verde sobre a porta aberta. A assinatura é
-- a mesma que a `0005` usa nas duas linhas de privilégio dela: `(text, uuid)`.
--
-- ⚠️ E O MODELO DE PRIVILÉGIO TEM UMA SUTILEZA QUE CUSTA CARO: no Supabase, o `alter default
-- privileges` concede EXECUTE a `authenticated` na CRIAÇÃO da função — por isso o `revoke all
-- … from public, anon` da `0005` nunca tirou esse grant. E `create or replace` de função que
-- já existe NÃO repassa o default (o objeto não é novo, a ACL é preservada), o que significa
-- que o `create or replace` logo acima não devolveria sozinho nada num banco que já tivesse
-- revogado. Daí esta linha ser explícita.
grant execute on function public.criar_workspace(text, uuid) to authenticated;
