-- 0040_assistente_padrao.sql — trocar o assistente padrao de um espaco de trabalho, sem uma
-- janela em que ele nao tem nenhum.
--
-- ⚠️ ADITIVA: so cria funcao. Nenhuma tabela muda, nenhuma linha muda de valor. Migration que
-- falha e container que NAO SOBE, em toda instalacao — o painel mantem a versao anterior
-- servindo e quem comprou nao entende por que a atualizacao "nao pegou".
--
-- 🔴 POR QUE UMA FUNCAO, E NAO DOIS `update` DA APLICACAO. Trocar o padrao sao duas escritas —
-- tirar do antigo, por no novo — e o indice unico PARCIAL que garante "no maximo um padrao"
-- nao pode ser adiado ate o fim da transacao: so uma `constraint` pode ser adiada, e indice
-- parcial nao vira constraint. Pelo servidor de dados cada `update` e uma requisicao propria,
-- em transacoes diferentes: entre as duas ha SEMPRE uma janela em que o espaco de trabalho nao
-- tem padrao nenhum, e se a segunda escrita falhar esse estado e PERMANENTE.
--
-- E o encadeamento e o dano de verdade, nao a janela: sem padrao, a recusa de excluir o padrao
-- nao dispara para ninguem, o espaco pode ser reduzido a um unico assistente NAO-padrao, e
-- todo canal sem atribuicao passa a responder com a persona vazia — para sempre, enquanto a
-- tela continua dizendo que aquele canal "usa o padrao". O corpo de uma funcao e uma
-- transacao: a janela existe, mas nunca escapa dela.
--
-- 🔴 E O INVARIANTE E "EXATAMENTE UM PADRAO", nao "no maximo um". O indice unico parcial
-- garante a metade de cima; a de baixo e do codigo, e ela mora em dois lugares: a criacao do
-- primeiro assistente de um espaco (que nasce padrao) e esta funcao.
create or replace function public.definir_assistente_padrao(p_ws uuid, p_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  achou int;
begin
  -- 🔴 O ALVO E CONFERIDO DENTRO DO ESPACO PEDIDO, e isto nao e simetria. O identificador chega
  -- do NAVEGADOR, e uma funcao `security definer` roda com os privilegios da dona do objeto:
  -- as regras de linha nao sao consultadas aqui. Sem este filtro, promover o assistente de
  -- OUTRO inquilino seria uma chamada — e o canal dele passaria a responder os clientes dele
  -- com o nome e a descricao do negocio de outra empresa.
  select count(*) into achou
    from public.assistentes
   where workspace_id = p_ws and id = p_id;
  -- Zero linhas e "esse assistente nao e deste espaco de trabalho". Quem traduz isso numa
  -- frase em portugues e a acao que chama; devolver o numero mantem a funcao muda sobre QUAL
  -- dos dois casos aconteceu, que e o que impede a resposta de confirmar um identificador
  -- chutado.
  if achou = 0 then return 0; end if;

  -- 🔴 A ORDEM E OBRIGATORIA: tirar do antigo ANTES de por no novo. Invertida, a segunda linha
  -- com `padrao` verdadeiro colide com o indice unico parcial e a funcao inteira levanta —
  -- sem estado quebrado, mas sem trocar nada tambem.
  update public.assistentes
     set padrao = false, atualizado_em = now()
   where workspace_id = p_ws and padrao and id <> p_id;

  update public.assistentes
     set padrao = true, atualizado_em = now()
   where workspace_id = p_ws and id = p_id and not padrao;

  return 1;
end $$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de `public`/`anon`. No Supabase o ALTER DEFAULT
-- PRIVILEGES concede EXECUTE a `authenticated` na CRIACAO da funcao, e o token do navegador e
-- desse papel — a caixa de entrada ja o entrega ao navegador por causa do tempo real. Como
-- `security definer` nao consulta policy nenhuma, o `grant` sobrando seria a porta inteira:
-- qualquer autenticado promoveria o assistente que quisesse, pulando a tela, o gate de licenca
-- e a conferencia de papel.
revoke all on function public.definir_assistente_padrao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.definir_assistente_padrao(uuid, uuid) to service_role;

comment on function public.definir_assistente_padrao(uuid, uuid) is
  'Troca o assistente padrao de um espaco de trabalho numa transacao so. Devolve 1 quando trocou e 0 quando o assistente nao e daquele espaco.';
