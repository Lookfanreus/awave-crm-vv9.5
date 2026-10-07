-- 0042_conversas_com_dono.sql — a conversa que tem um responsavel passa a dizer isso no
-- proprio status.
--
-- ⚠️ ADITIVA: nenhuma coluna nasce, nenhuma some, nenhum dominio muda. O que muda e DADO —
-- linhas que ja existem — e por isso ela roda uma vez e nao tem nada a fazer na segunda.
--
-- Por que ela existe: o assistente automatico nao responde conversa que tem responsavel, e a
-- caixa de entrada passou a marcar essas conversas na lista e a oferecer "Devolver ao
-- assistente" nelas. As duas coisas leem o STATUS. Uma linha antiga podia ter responsavel com
-- o status ainda em `aberta` — ela vinha da epoca em que escolher alguem era so triagem, e
-- volta a nascer assim quando uma conversa arquivada e reaberta pela mensagem seguinte do
-- cliente. Nessas linhas o assistente ficava calado e a tela nao mostrava nem o motivo nem a
-- saida: sem marcador na lista e sem o botao de devolver.
--
-- 🔴 O `atribuida_a is not null` E OBRIGATORIO, e nao e detalhe de estilo. Sem ele este
-- comando alcancaria conversas comuns e as calaria de uma vez — o oposto do que ele conserta.
--
-- E `assumida_em` so e preenchido quando esta VAZIO. Ele e o "desde quando" que a lista
-- mostra, e sobrescrever um carimbo verdadeiro por `now()` faria uma conversa esquecida ha
-- semanas parecer que acabou de ser assumida, que e exatamente a informacao que o marcador
-- existe para dar.
update public.conversas
   set status = 'assumida',
       assumida_em = coalesce(assumida_em, now()),
       atualizado_em = now()
 where status = 'aberta'
   and atribuida_a is not null;
