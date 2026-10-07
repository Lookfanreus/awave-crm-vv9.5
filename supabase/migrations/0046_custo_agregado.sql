-- 0046_custo_agregado.sql — a soma do painel de gasto passa a acontecer DENTRO do banco.
--
-- ⚠️ ADITIVA: so cria funcao. Nenhuma tabela muda, nenhuma coluna sai, nenhuma linha muda de
-- valor, nenhuma chamada existente para de resolver. Migration que falha e container que NAO
-- SOBE, em toda instalacao — o painel mantem a versao anterior servindo e quem comprou nao
-- entende por que a atualizacao "nao pegou".
--
-- 🔴 POR QUE ISTO E UMA FUNCAO, E NAO UM TETO NA LEITURA. O painel lia `custos_ia` do mes
-- INTEIRO, linha a linha, e somava em memoria — sem paginacao e sem teto nenhum. O servidor de
-- dados corta o resultado num teto proprio e devolve sucesso sem dizer nada: com a conta grande
-- o painel afirmava um numero MENOR que a fatura, e nenhum erro aparecia em lugar nenhum. Pedir
-- um teto explicito so trocaria o corte mudo dele pelo nosso. A soma tem de acontecer onde o
-- dado esta.
--
-- 🔴 E ELA DEVOLVE UM GRUPO POR (espaco de trabalho, modelo), E NAO UM TOTAL SO. Duas coisas
-- que a tela mostra dependem de conhecimento que vive no CODIGO e nao no banco: o recorte "qual
-- cliente responde por oitenta por cento da conta" (o motivo de o painel ter uma lista) e a
-- regra de que embedding NAO conta como conversa — ela sai da tabela de precos do aplicativo,
-- que envelhece a cada modelo novo. Repetir aquela tabela aqui em SQL criaria duas fontes para
-- o mesmo fato, e no dia em que discordassem ninguem saberia qual esta certa. Agrupar e o
-- meio-termo: a soma pesada fica no banco, a interpretacao fica onde ela ja mora, e o numero de
-- linhas devolvido passa a ser o numero de espacos vezes o numero de modelos.
--
-- 🔴 `grupos` E O QUE TORNA O CORTE AUDIVEL, e sem ele esta funcao so mudaria o corte de lugar.
-- Toda linha carrega quantos grupos a consulta TERIA entregue; quem le compara com o que
-- recebeu. Vindo menos, a leitura esta incompleta e a tela diz "nao consegui ler" — jamais um
-- total menor que a fatura, que e a unica coisa que este painel nao pode fazer.
--
-- 🔴 SEM RECORTE POR ESPACO DE TRABALHO, E A AUSENCIA E O REQUISITO. A chave da conta de modelo
-- e UMA e a fatura e UMA: um painel escopado mostraria menos do que a conta cobra, que e o
-- oposto do que ele existe para fazer. Quem pode ver e quem instalou o servidor, e essa
-- conferencia acontece no aplicativo, antes desta chamada. O recorte por espaco que a tela
-- mostra sai do AGRUPAMENTO abaixo, nunca de um filtro.
--
-- 🔴 ELA NAO E `security definer`, E ISSO E DELIBERADO. Quem a chama e o papel de servico, que
-- ignora as regras de linha de qualquer jeito — entao rodar como dona do objeto nao compraria
-- nada e custaria a unica rede que sobra. Rodando como QUEM CHAMA, um privilegio de execucao
-- que vazasse para o token do navegador ainda esbarraria nas regras de linha de `custos_ia`,
-- que nao tem regra de membro nenhuma: o resultado seria vazio, e nao a conta do servidor
-- inteiro. O privilegio e revogado logo abaixo de qualquer forma; isto e a segunda barreira.
create or replace function public.custo_do_deploy(p_desde timestamptz)
returns table (
  workspace_id uuid,
  modelo text,
  linhas bigint,
  sem_preco bigint,
  tokens_entrada bigint,
  tokens_saida bigint,
  custo_usd numeric,
  grupos bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.ws,
    g.mod,
    g.qtd,
    g.nulos,
    g.entrada,
    g.saida,
    g.soma,
    -- Quantos grupos existem no resultado inteiro, repetido em cada linha. E a unica maneira de
    -- quem le saber que recebeu tudo: a resposta cortada nao carrega marca nenhuma.
    count(*) over () as grupos
  from (
    select
      c.workspace_id                                  as ws,
      c.modelo                                        as mod,
      count(*)                                        as qtd,
      -- 🔴 CONTADO AQUI, E SEPARADO DA SOMA. `sum` de nulos e nulo, e nulo somado a numero
      -- desaparece sem deixar rastro: sem esta contagem, uma rodada cujo modelo nao esta na
      -- tabela de precos sumiria da conta em silencio, e a tela nao teria como escrever
      -- "pelo menos".
      count(*) filter (where c.custo_usd is null)     as nulos,
      coalesce(sum(c.tokens_entrada), 0)              as entrada,
      coalesce(sum(c.tokens_saida), 0)                as saida,
      -- O que se SABE que foi gasto. Zero aqui com `nulos > 0` nao e "nao gastou": e "nao sei
      -- o preco de nada disto", e quem le tem a outra coluna para dizer isso.
      coalesce(sum(c.custo_usd), 0)                   as soma
    from public.custos_ia c
    where c.criado_em >= p_desde
    group by c.workspace_id, c.modelo
  ) g
$$;

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de `public`/`anon`. Neste servidor de dados o
-- privilegio padrao concede EXECUTE a `authenticated` na CRIACAO da funcao, e o token desse
-- papel esta no NAVEGADOR (a caixa de entrada ja o entrega la por causa do tempo real). Esta
-- funcao atravessa espacos de trabalho de proposito: o privilegio sobrando seria a lista de
-- clientes de quem instalou, com o quanto cada um custa, a uma chamada de distancia.
revoke all on function public.custo_do_deploy(timestamptz)
  from public, anon, authenticated;
grant execute on function public.custo_do_deploy(timestamptz) to service_role;

comment on function public.custo_do_deploy(timestamptz) is
  'O gasto com modelo de linguagem desde um instante, agrupado por espaco de trabalho e modelo. Nao filtra por espaco de proposito: a conta e do servidor inteiro. `grupos` diz quantas linhas o resultado tem, para que uma resposta cortada nao passe por um total.';
