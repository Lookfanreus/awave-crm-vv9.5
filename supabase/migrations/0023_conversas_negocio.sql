-- 0023_conversas_negocio.sql — onde a conversa grava que ja virou negocio.
--
-- ⚠️ ADITIVA E NULAVEL, como manda o invariante de migrations do produto. Migration que
-- falha e container que NAO SOBE, em toda instalacao: o EasyPanel mantem a versao anterior e
-- o comprador fica sem entender por que a atualizacao "nao pegou".
--
-- 🔴 SEM ESTA COLUNA NAO EXISTE IDEMPOTENCIA no "virar negocio". Dois cliques criariam dois
-- cartoes no mesmo funil, e desfazer isso e trabalho manual do comprador — pior, e trabalho
-- que ele so descobre quando o funil ja esta sujo. O marcador mora na CONVERSA porque a
-- pergunta que a tela faz e "esta conversa ja virou?", e nao "existe algum negocio parecido?".
alter table public.conversas add column if not exists negocio_id uuid;

-- 🔴 FK COMPOSTA, igual a conversas.atribuida_a (0022:63-66) e a negocios.responsavel_id
-- (0004:71-74). FK simples para negocios(id) deixaria ligar a conversa a um negocio de OUTRO
-- workspace — e aqui a escrita vem de uma acao de tela, com admin(), sem RLS para pegar o
-- erro: o filtro do codigo e a unica barreira, e a FK e o cinto que sobrevive a um descuido.
--
-- O alvo ja existe: `negocios_ws_id_key unique (workspace_id, id)`, criado na 0011:11.
--
-- SET NULL so na COLUNA (PG15+), exatamente como a 0004:74 e a 0022:66 ja fazem: workspace_id
-- e NOT NULL e nao pode ir a null — um `on delete set null` sem a lista de colunas tentaria
-- zerar as duas e falharia no momento em que alguem apagasse um negocio.
--
-- MATCH SIMPLE (o default): com negocio_id nulo a FK nao checa nada, que e o estado normal de
-- toda conversa que ainda nao virou.
-- 🔴 GUARDADA pelo `pg_constraint`. `add constraint` nao aceita `if not exists`, e este
-- arquivo declara tolerar objeto pre-existente na coluna logo acima (`add column if not
-- exists`): meia-idempotencia e pior que nenhuma, porque convida a reexecucao e para no
-- meio. Numa base em que a coluna ja exista e a FK tambem — migration aplicada a mao pelo
-- editor de SQL sem registrar a versao em `public.awave_migrations`, que e o estado que
-- este repositorio ja viveu — o boot reaplica o arquivo, sai `42710` cru e o container NAO
-- SOBE, em toda instalacao.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'conversas_negocio_fk' and conrelid = 'public.conversas'::regclass
  ) then
    alter table public.conversas
      add constraint conversas_negocio_fk
      foreign key (workspace_id, negocio_id)
      references public.negocios (workspace_id, id) on delete set null (negocio_id);
  end if;
end $$;

comment on column public.conversas.negocio_id is
  'Negocio criado a partir desta conversa. Nulo enquanto ela nao virou. E o que torna o "virar negocio" idempotente.';
