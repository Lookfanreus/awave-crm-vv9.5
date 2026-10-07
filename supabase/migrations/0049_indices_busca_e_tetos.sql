-- 0049_indices_busca_e_tetos.sql — quatro consertos que cabem em SQL aditivo: o indice que
-- faltou na fila de saida, o vizinho mais proximo que era do servidor inteiro, a consulta final
-- da busca que varria a base de todos os espacos de trabalho, e os tetos de tamanho da base.
--
-- ⚠️ ADITIVA: dois indices novos, um indice antigo que sai, a busca reescrita no mesmo formato,
-- e duas restricoes de tamanho. Nenhuma coluna nasce, nenhuma sai, nenhuma chamada existente
-- deixa de resolver. Migration que falha e container que NAO SOBE, em toda instalacao.
--
-- 🔴 NENHUM `create index` AQUI E CONCORRENTE, E ISSO NAO E DESCUIDO. O aplicador de migrations
-- do container embrulha CADA ARQUIVO numa transacao, e `create index concurrently` e recusado
-- pelo Postgres dentro de transacao — a migration falharia, e migration que falha e container
-- que nao sobe. Sustentar o concorrente exigiria um marcador de "fora de transacao" no
-- aplicador, que nao existe; e o aplicador e arquivo conferido por soma, que nao se edita por
-- aqui.
--
-- O CUSTO ACEITO, escrito — e sao TRES formas de trava, nao uma:
--   · `create index` varre a tabela uma vez e segura a ESCRITA dela enquanto varre. LEITURA
--     continua fluindo (`select` nao conflita), entao o container antigo segue servindo. Em
--     `mensagens`, que e a tabela que mais cresce, essa varredura e proporcional ao historico ja
--     trocado; em `base_conhecimento` ela e desprezivel;
--   · `drop index` e `alter table ... add constraint` tomam trava EXCLUSIVA, que barra tambem a
--     LEITURA. As duas sao instantaneas aqui (o `drop` nao varre nada, e o `not valid` do passo
--     4 e o que impede o `add constraint` de varrer);
--   · e o arquivo inteiro roda numa transacao so, entao TODA trava tomada aqui fica retida ate o
--     fim do arquivo, nao ate o fim da instrucao.
--
-- 🔴 E POR ISSO A ORDEM DAS INSTRUCOES ABAIXO E LOAD-BEARING. A unica instrucao demorada e a
-- primeira (o indice sobre `mensagens`), e ela toma trava de escrita sobre `mensagens`. As
-- travas exclusivas sobre `base_conhecimento` so entram nos passos 2 a 4, todos rapidos, e por
-- isso a janela em que a base do assistente fica sem LEITURA e curta. Mover qualquer um deles
-- para antes do passo 1 faria essa janela durar a construcao do indice de `mensagens` inteira —
-- com a base do assistente, que esta no caminho quente de toda resposta, ilegivel o tempo todo.
-- Ha barreira que fixa esta ordem.

-- O search_path desta SESSAO, para o tipo e o operador da busca resolverem durante a aplicacao.
set local search_path = public, extensions;

-- ── 1. a fila de saida ganha o indice que a fila irma ja tinha ──────────────────────────
--
-- 🔴 SEM ELE A RESERVA DA FILA DE SAIDA VARRE `mensagens` INTEIRA A CADA ~30 SEGUNDOS.
-- `reservar_mensagens` (0022) procura por `status = 'pendente' and direcao = 'saida' and
-- desistido_em is null`, ordena por `criado_em` e leva as primeiras. Os tres indices que a 0022
-- cria sobre esta tabela sao `(workspace_id, externo_id)`, `(workspace_id)` e
-- `(conversa_id, origem_em desc)`, e o da 0024 e sobre o estado da midia: nenhum deles cobre
-- esse predicado, entao sobra varredura da tabela inteira mais ordenacao — numa tabela que ganha
-- uma linha por mensagem recebida E enviada e nunca encolhe. Com a fila VAZIA o trabalho e o
-- mesmo: a varredura acontece para nao achar nada. O sintoma nao aparece em desenvolvimento nem
-- no primeiro mes; ele aparece na instalacao com volume, como um tick que fica lento.
--
-- O predicado do indice e IGUAL ao da consulta, palavra por palavra. Indice parcial so serve a
-- quem repete o predicado dele: o Postgres nao deriva um predicado de outro, e um indice que
-- ninguem usa custa escrita em toda gravacao sem servir leitura nenhuma.
--
-- ⚠️ O QUARTO FILTRO DA CONSULTA — `coalesce(proxima_tentativa, criado_em) <= now()` — NAO entra
-- aqui, e nao e esquecimento: `now()` nao e imutavel, e o predicado de um indice parcial so
-- aceita expressao imutavel. Ele continua sendo filtro aplicado sobre a linha lida; o que muda e
-- que passa a ser sobre as poucas linhas do indice, e nao sobre a tabela inteira.
--
-- A coluna indexada e `criado_em` porque e por ela que a consulta ordena: o `limit` do teto por
-- tick e atendido percorrendo o indice NA ORDEM em vez de ordenar um conjunto.
--
-- ⚠️ MAS NAO SAO "AS PRIMEIRAS ENTRADAS" — SAO AS PRIMEIRAS QUE PASSAM NO RECHECK, e elas podem
-- estar fundo. `proxima_tentativa` nao esta no indice, entao a metade temporal do predicado so
-- pode ser conferida na propria linha: o percurso anda pelas entradas em ordem de `criado_em`
-- DESCARTANDO as inelegiveis ate juntar o teto do tick. E quem produz inelegivel e a propria
-- reserva (ela empurra `proxima_tentativa` para o futuro sem mexer no status) e a retentativa de
-- quem falhou. O pior caso tem nome: com um canal fora do ar, TODO o acumulo vivo fica
-- inelegivel e o percurso atravessa o indice inteiro, a cada tick, para nao achar nada.
--
-- Ainda assim e a melhora que se buscava, e a diferenca de escala e a razao: o percurso passa a
-- ser sobre o acumulo VIVO (dezenas a milhares de linhas) e nao sobre o historico de `mensagens`
-- (que so cresce). A opcao de fechar tambem esse pior caso tem nome — carregar
-- `proxima_tentativa` no indice como coluna incluida, para o recheck acontecer dentro dele — e
-- NAO foi tomada: ela so paga se o percurso virar leitura so-de-indice, o que depende do mapa de
-- visibilidade da tabela, e numa fila que e reescrita o tempo todo ele quase nunca esta limpo.
-- Sem medir contra um banco de verdade isso seria um palpite trocando por outro.
--
-- 🔴 E AQUI ELE NAO ENCOLHE PELO MESMO MOTIVO DA FILA DE MIDIA — nao repita o argumento de la.
-- Naquela, a linha SAI do indice no instante em que o dreno a carimba. Nesta, a reserva NAO
-- muda o status: ela so escreve `enviando_desde` e `proxima_tentativa`, entao a linha reservada
-- continua `pendente` e continua no indice ate o desfecho (`enviada`, `falhou`, ou o carimbo de
-- desistencia). O mesmo vale para a linha que falhou e vai ser retentada: ela espera DENTRO do
-- indice. Ainda e pequeno, porque o que esta ali e o acumulo VIVO e nao o historico — mas quem
-- o mantem pequeno e o desfecho de cada mensagem, nao a reserva.
create index if not exists mensagens_fila_saida_idx
  on public.mensagens (criado_em)
  where status = 'pendente' and direcao = 'saida' and desistido_em is null;

-- ── 2. o vizinho mais proximo deixa de ser do servidor inteiro ──────────────────────────
--
-- 🔴 O INDICE VETORIAL DA 0030 ERA DO SERVIDOR INTEIRO, E O FILTRO DE ESPACO DE TRABALHO E
-- APLICADO DEPOIS DELE. Num percurso desse tipo de indice o banco devolve um numero fixo de
-- candidatos (quarenta, por padrao) e so entao aplica as condicoes do `where` ao que voltou.
-- Numa instalacao que hospeda varios clientes, os quarenta vizinhos mais proximos podem ser
-- todos de OUTRO cliente: todos sao descartados pelo filtro de espaco, e o braco semantico
-- devolve ZERO para quem perguntou — sem erro, sem registro, e com a base daquele espaco
-- intacta e cheia. Sobra o braco textual, que erra parafrase, que e como o cliente escreve; e o
-- assistente, proibido de inventar, responde que nao sabe uma resposta que esta escrita ali.
--
-- ⚠️ CORRECAO PASSA NA FRENTE DE VELOCIDADE: o indice de hoje e rapido e responde a pergunta
-- errada. Ele sai, e entra um B-tree que leva o planejador direto as linhas DAQUELE espaco que
-- tem vetor do carimbo atual. A ordenacao por distancia passa a ser exata sobre esse conjunto —
-- que e o unico conjunto que a resposta podia usar desde sempre.
--
-- A ARITMETICA — e ela NAO foi medida contra banco nenhum. Esta escrita para poder ser
-- conferida, nao para ser acreditada:
--   · a coluna e `vector(1536)`. Um vetor desses ocupa 1536 x 4 bytes mais 8 de cabecalho =
--     6152 bytes, acima do limite (cerca de 2 KB) em que o Postgres guarda o valor FORA da
--     linha. Ler mil vetores e da ordem de 6 MB; dez mil, 60 MB. E esta leitura, e nao a conta,
--     que domina o custo da varredura exata.
--   · a distancia de cosseno em 1536 dimensoes e da ordem de um microssegundo por linha em
--     processador com instrucao vetorial. Mil linhas dao poucos milissegundos de aritmetica.
--   · o teto de tempo da busca do assistente e de 4 segundos, e ele cobre TAMBEM a chamada de
--     rede que calcula o vetor da pergunta, que costuma levar a maior parte dele. O que sobra
--     para esta consulta e o resto desses 4 segundos, nao os 4.
--   · o conjunto varrido passa a ser o do espaco de trabalho, e nao o do servidor. Hoje toda
--     entrada e digitada uma a uma na tela, com teto de 4000 caracteres por entrada, e nao
--     existe caminho de importacao em massa — e e isso que torna a varredura exata defensavel.
--     No dia em que existir importacao, esta conta tem de ser refeita ANTES.
--   · 🔴 A PARTIR DE QUE TAMANHO DE BASE A VARREDURA EXATA DEIXA DE CABER, EU NAO SEI, e nao
--     invento: depende do disco, da memoria e do que mais divide o servidor. O que se sabe da
--     forma da conta e que o custo cresce LINEARMENTE com o numero de entradas com vetor
--     daquele espaco, e que o sinal de que passou do ponto e a busca comecar a estourar o teto
--     de tempo — que e estado desenhado, com marca na caixa de entrada, e nao uma falha muda.
--
-- As colunas sao `(workspace_id, embed_versao)` porque sao as duas igualdades do braco
-- semantico, e o parcial `where embedding is not null` casa o filtro que a consulta ja faz e
-- mantem fora do indice a entrada que ainda nao foi vetorizada.
create index if not exists base_conhecimento_vetor_idx
  on public.base_conhecimento (workspace_id, embed_versao)
  where embedding is not null;

-- O par `create` acima + `drop` abaixo sobrevive no historico de proposito: editar a 0030 no
-- lugar disto deixaria o indice antigo VIVO em todo banco em que ela ja rodou — o aplicador
-- versiona pelo prefixo do arquivo e nao reexecuta o que ja registrou. Conserto que precisa
-- alcancar banco existente entra em migration NOVA, sempre.
drop index if exists public.base_conhecimento_emb_idx;

-- ── 3. a consulta final da busca para de varrer a base de todos os espacos ──────────────
--
-- 🔴 `create or replace`, E NAO `drop` + `create` — A ASSINATURA E EXATAMENTE A MESMA. Duas
-- consequencias, e as duas sao o motivo da escolha:
--   · nao ha como nascer uma sobrecarga. `drop function if exists` com a lista de tipos errada
--     e NO-OP SILENCIOSO: nao da erro, nao derruba o boot, e o banco fica com duas funcoes
--     candidatas — e ai a chamada do produto vira ambigua e a base de conhecimento fica
--     indisponivel em toda conversa de toda instalacao, com todo arquivo, lido sozinho, certo.
--     Sem mudanca de assinatura, esse modo de falha nao existe;
--   · `create or replace` PRESERVA dono e permissoes. O objeto nao nasce, e substituido: o
--     privilegio padrao deste servidor de dados, que acende `execute` para o papel do navegador
--     na CRIACAO de uma funcao, nao e aplicado de novo. A revogacao que a 0041 fez continua
--     valendo, e repeti-la aqui seria afirmar um endurecimento que quem le conferiria no lugar
--     errado.
--
-- O QUE MUDA E SO O `from` EXTERNO. Ele era `from public.base_conhecimento b` sem filtro
-- nenhum, com dois `left join` por `id` segurando o resultado. Nao vazava — `id` e chave
-- primaria, entao o `join` so casa a mesma linha —, mas o planejador nao tinha por onde usar
-- indice: a consulta final varria a tabela de TODOS os espacos de trabalho, uma vez por rodada
-- do assistente e uma vez por consulta que o modelo pede. Agora ela parte da uniao dos
-- identificadores que as duas CTEs ja escolheram (no maximo quatro vezes o limite pedido) e
-- casa cada um por chave primaria, com a igualdade de espaco de trabalho junto: barata, e ela
-- transforma em barreira o que ate aqui dependia de `id` continuar sendo unico no servidor
-- inteiro.
--
-- O `where textual.id is not null or semantico.id is not null` sai porque a uniao ja e o
-- conjunto que ele descrevia: com o `join` positivo, nao existe linha para descartar.
--
-- TUDO O MAIS E VERBATIM DA 0041, e cada peca abaixo tem um jeito silencioso de morrer:
--   · `search_path = extensions` e obrigatorio — o operador de distancia e o tipo do vetor
--     vivem la, e operador NAO se qualifica por prefixo. Vazio ou `public` quebra a busca por
--     similaridade inteira;
--   · `p_assistente` mantem o `default null`, e `null` significa VE TUDO — nunca "nenhum
--     assistente". E o chao de todo espaco que nunca recortou nada, e e o que faz as chamadas
--     que nao mandam o parametro continuarem resolvendo;
--   · o predicado do recorte tem DUAS metades e vive no `where` de CADA CTE, antes do `limit`
--     de cada uma. Sem o `coalesce(..., true)`, bloco sem juncao devolve `null`, e `null` num
--     `and` do `where` DESCARTA a linha: "sem restricao" viraria "invisivel para todo mundo".
create or replace function public.base_conhecimento_buscar(
  p_ws uuid,
  p_query text,
  p_embedding extensions.vector(1536),
  p_versao text,
  p_limite int,
  p_tipos text[],
  p_assistente uuid default null
) returns table (id uuid, titulo text, conteudo text, tipo text, score float)
language sql stable security definer set search_path = extensions as $$
with textual as (
  select b.id, row_number() over (
           order by ts_rank_cd(b.fts, websearch_to_tsquery('portuguese', p_query)) desc) as posicao
    from public.base_conhecimento b
   where b.workspace_id = p_ws and b.habilitado
     and (p_tipos is null or b.tipo = any(p_tipos))
     and coalesce(
           (select bool_or(ab.assistente_id = p_assistente)
              from public.assistente_blocos ab
             where ab.bloco_id = b.id and ab.workspace_id = b.workspace_id),
           true)
     and b.fts @@ websearch_to_tsquery('portuguese', p_query)
   limit p_limite * 2
), semantico as (
  select b.id, row_number() over (order by b.embedding <=> p_embedding) as posicao
    from public.base_conhecimento b
   where b.workspace_id = p_ws and b.habilitado
     and (p_tipos is null or b.tipo = any(p_tipos))
     and coalesce(
           (select bool_or(ab.assistente_id = p_assistente)
              from public.assistente_blocos ab
             where ab.bloco_id = b.id and ab.workspace_id = b.workspace_id),
           true)
     and p_embedding is not null
     and b.embedding is not null
     and b.embed_versao = p_versao
   order by b.embedding <=> p_embedding
   limit p_limite * 2
), alvo as (
  -- Os dois `id` vao QUALIFICADOS. A funcao declara `returns table (id uuid, ...)`, e essas
  -- colunas de saida sao nomes em escopo dentro do corpo: um `id` solto e a unica referencia
  -- ambigua que este arquivo poderia introduzir, e ambiguidade no corpo de uma funcao `sql` e
  -- recusada na CRIACAO — ou seja, na migration, no boot, em toda instalacao.
  select textual.id from textual
  union
  select semantico.id from semantico
)
select b.id, b.titulo, b.conteudo, b.tipo,
       (coalesce(1.0 / (60 + textual.posicao), 0.0)
      + coalesce(1.0 / (60 + semantico.posicao), 0.0))::float as score
  from alvo
  join public.base_conhecimento b on b.id = alvo.id and b.workspace_id = p_ws
  left join textual on textual.id = b.id
  left join semantico on semantico.id = b.id
 order by score desc
 limit p_limite;
$$;

-- ── 4. os tetos de tamanho da base de conhecimento ──────────────────────────────────────
--
-- 🔴 OS TETOS SAO PARTE DO ESQUEMA, e o motivo e de AUTORIDADE, nao de estetica — a mesma razao
-- ja escrita para a persona: quem edita estes campos e o dono do espaco de trabalho, e quem paga
-- a fatura de tokens e o dono da INSTALACAO. A base alimenta o mesmo texto de instrucao, na
-- mesma fatura. `titulo` e `conteudo` nasceram sem teto nenhum; os limites existiam so na
-- validacao da tela, que devolve uma frase em portugues e NAO substitui isto — o `check` e a
-- segunda barreira, e a unica que vale para quem escreve por fora da tela.
--
-- Hoje o unico caminho de escrita e a tela, entao isto e defesa em profundidade e nao conserto
-- de defeito alcancavel. E e por isso que e AGORA: enquanto toda linha existente passou pela
-- validacao, a restricao nao pode reprovar dado gravado. Depois do segundo escritor, ela pode —
-- e migration que falha e container que nao sobe.
--
-- 🔴 `not valid`, E O QUE ELE COMPRA E A VARREDURA — nao a trava. `add constraint` toma trava
-- exclusiva na tabela de qualquer jeito; com `not valid` o Postgres PULA a verificacao das
-- linhas que ja existem, entao a trava e o tempo de uma escrita no catalogo em vez do tempo de
-- uma passada pela tabela. Isso importa aqui porque nao ha indice concorrente disponivel (ver o
-- cabecalho) e porque a migration roda no boot, com o container antigo ainda servindo. E ele
-- vale integralmente para toda escrita NOVA, que e exatamente o que faltava.
--
-- Os numeros sao os mesmos da validacao da tela, e ha barreira que le os dois lados e reprova se
-- divergirem. O `check` NAO pode ser mais estrito que ela, ou a tela passa a recusar no banco o
-- que ela mesma aceitou: `length()` no Postgres conta CARACTERES e a contagem da tela conta
-- unidades de 16 bits, entao um caractere fora da faixa basica (um emoji) conta 2 na tela e 1
-- aqui. A contagem da tela e sempre maior ou igual, entao o que ela aceita este `check` aceita.
--
-- Guardado por catalogo porque o Postgres nao tem `add constraint if not exists`, e uma segunda
-- passada nao pode falhar. O `conrelid` entra junto: nome de restricao e unico por TABELA, nao
-- por banco, e conferir so o nome acusaria uma homonima de outra tabela.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'base_conhecimento_titulo_teto'
       and conrelid = 'public.base_conhecimento'::regclass
  ) then
    alter table public.base_conhecimento
      add constraint base_conhecimento_titulo_teto check (length(titulo) <= 120) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'base_conhecimento_conteudo_teto'
       and conrelid = 'public.base_conhecimento'::regclass
  ) then
    alter table public.base_conhecimento
      add constraint base_conhecimento_conteudo_teto check (length(conteudo) <= 4000) not valid;
  end if;
end $$;
