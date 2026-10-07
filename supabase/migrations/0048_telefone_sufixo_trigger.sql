-- 0048_telefone_sufixo_trigger.sql — `contatos.telefone_sufixo` deixa de ser uma coluna que
-- UMA porta lembra de preencher e passa a ser DERIVADA pelo banco.
--
-- 🔴 A RAIZ. O sufixo era escrito so pelo webhook de canal. Contato criado pela ficha, importado
-- por CSV ou criado pela API v1 nascia SEM sufixo — e quando essa mesma pessoa mandava mensagem,
-- a busca por candidatos (`workspace_id, telefone_sufixo`, indice da 0022) nao achava NADA e o
-- codigo concluia "nao existe": nascia uma DUPLICATA do cliente que ja estava la, com o historico
-- partido em dois. A 0022 backfillou uma vez, entao o defeito e invisivel em todo contato
-- anterior a ela e certo em todo contato criado depois por essas tres portas.
--
-- 🔴 GATILHO, E NAO UM AJUDANTE CHAMADO PELAS QUATRO PORTAS. A ideia original era um ajudante
-- unico que as quatro portas chamariam; ele nunca nasceu, e essa e a prova de que o modelo esta
-- errado: cada porta nova — a API v1, a importacao, a zona de customizacao do comprador, uma acao
-- de tela de amanha — e mais uma chance de esquecer, e o esquecimento nao tem sintoma nenhum ate
-- o dia em que o cliente manda mensagem. O gatilho cobre inclusive as portas que ainda NAO
-- EXISTEM, porque quem preenche e o banco.
--
-- ⚠️ ADITIVA: duas funcoes novas, um gatilho novo e um `update` sobre dado do comprador. Nenhuma
-- coluna nasce, nenhuma sai, nenhuma chamada existente para de resolver. Migration que falha e
-- container que NAO SOBE, em toda instalacao.

-- ── a regra, num lugar so ──────────────────────────────────────────────────────────────
--
-- 🔴 ELA TEM DE CONCORDAR COM `sufixoTelefone` (`src/lib/canais/telefone.ts`), PORQUE AS DUAS
-- PONTAS DO CASAMENTO SAO CODIGOS DIFERENTES: quem GRAVA a chave passa a ser este SQL, quem
-- PROCURA por ela continua sendo o TypeScript. Se as regras divergirem, a busca erra do mesmo
-- jeito que erra hoje — com outra causa, e sem sintoma nenhum na tela. Por isso cada peca abaixo
-- e a traducao literal de uma linha de la, e ha barreira que extrai estas pecas do disco e as
-- executa contra a mesma matriz de casos do modulo puro.
--
--   · `@lid` recusa TUDO. O LID e identificador opaco do WhatsApp e NAO mapeia para telefone:
--     trata-lo como numero criaria contato cujo "telefone" nao disca. A 0022 nao tinha esta
--     recusa (ela limpava a string inteira), entao `<digitos>@lid` produzia sufixo la.
--   · So o que vem ANTES do `@` e telefone. `split_part` e o par de `id.split('@')[0]`; sem ele,
--     `abc@123456789` viraria "telefone" com os digitos do DOMINIO.
--   · Faixa 8..15: o piso separa telefone de lixo, o teto e o E.164. Sem teto, `'9'.repeat(300)`
--     seria "telefone valido" — e o valor vem de quem manda a mensagem.
--     ⚠️ O piso e de COMPRIMENTO, nao de FORMA: uma data (`01022026`), um CPF ou um CNPJ
--     digitado no campo de telefone pela ficha ou vindo de uma coluna trocada no CSV cai na
--     faixa e vira sufixo. Isso so DESPERDICA candidato de indice — quem decide o casamento e
--     `mesmoTelefone`, que canonicaliza e recusa tudo que nao tem forma de telefone brasileiro.
--   · Os 8 ultimos digitos, e so isso. 🔴 CANDIDATO DE INDICE, NAO VEREDITO: 8 digitos descartam
--     o nono digito E O DDD JUNTO, entao dois assinantes iguais em DDDs diferentes produzem o
--     mesmo valor. Quem DECIDE e a comparacao canonica do codigo. Casar por aqui funde duas
--     pessoas num registro so, e isso nao se desfaz.
--
-- `immutable` e obrigatorio, e nao estilo: o gatilho e o backfill precisam da mesma resposta para
-- a mesma entrada, sempre. Ela nao le tabela nem relogio, entao a promessa e honesta.
create or replace function public.sufixo_telefone(p_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when p_id is null then null
           when position('@lid' in p_id) > 0 then null
           when length(digitos) between 8 and 15 then right(digitos, 8)
           else null
         end
    from (select regexp_replace(split_part(p_id, '@', 1), '\D', '', 'g') as digitos) as x
$$;

comment on function public.sufixo_telefone(text) is
  'Os 8 ultimos digitos de um identificador de contato — a CHAVE DE INDICE de contatos.telefone_sufixo. Candidato de busca, nunca veredito: ela descarta o nono digito e o DDD junto. Gemea de sufixoTelefone (src/lib/canais/telefone.ts); as duas tem de concordar.';

-- 🔴 REVOGA DE `authenticated` TAMBEM, e nao so de `public`/`anon`. Neste servidor de dados o
-- privilegio padrao concede EXECUTE a `authenticated` na CRIACAO da funcao, e o token desse papel
-- esta no NAVEGADOR (a caixa de entrada ja o entrega la por causa do tempo real). Nada da tela
-- precisa desta funcao: quem escreve contato e sempre o papel de servico.
revoke all on function public.sufixo_telefone(text) from public, anon, authenticated;

-- 🔴 E O `grant` AO PAPEL DE SERVICO NAO E SIMETRIA — ELE E NECESSARIO. A permissao do corpo de
-- uma funcao `plpgsql` que NAO e `security definer` e conferida em tempo de EXECUCAO contra quem
-- esta escrevendo; o gatilho abaixo chama esta funcao, e toda escrita de contato do produto sai
-- pelo papel de servico. Sem esta linha, o `revoke` acima transformaria toda gravacao de contato
-- num erro de permissao — em toda instalacao, no primeiro contato salvo depois da atualizacao.
grant execute on function public.sufixo_telefone(text) to service_role;

-- ── o gatilho ──────────────────────────────────────────────────────────────────────────
--
-- `before insert or update`, e as DUAS metades sao necessarias:
--   · so `insert` deixaria a ficha que CORRIGE um telefone errado com o sufixo velho — a busca
--     acharia a pessoa pelo numero que ela nao usa mais e nao pelo que ela usa;
--   · so `update` nao cobriria porta nenhuma de criacao, que e exatamente onde o defeito nasce.
--
-- `before` porque um gatilho `after` nao consegue mais escrever na linha. E incondicional de
-- proposito: um `when (new.telefone is distinct from old.telefone)` parece economia e abre um
-- buraco — a linha cujo sufixo foi gravado errado por outro caminho ficaria errada para sempre.
create or replace function public.contatos_set_telefone_sufixo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.telefone_sufixo := public.sufixo_telefone(new.telefone);
  return new;
end $$;

-- O `revoke` da irma, pelo mesmo motivo — e ele NAO impede o gatilho de disparar: a permissao de
-- uma funcao de gatilho e conferida na CRIACAO do gatilho, nunca a cada disparo.
revoke all on function public.contatos_set_telefone_sufixo() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'contatos_set_telefone_sufixo'
                 and tgrelid = 'public.contatos'::regclass) then
    create trigger contatos_set_telefone_sufixo
      before insert or update on public.contatos
      for each row execute function public.contatos_set_telefone_sufixo();
  end if;
end $$;

-- ── o backfill, SEM carimbar `atualizado_em` ───────────────────────────────────────────
--
-- 🔴 O QUE A 0022 FEZ E NAO SE REPETE AQUI. O backfill dela disparou `contatos_set_atualizado`
-- (gatilho `before update` que grava `now()` incondicionalmente) e reescreveu `atualizado_em` de
-- TODO contato com telefone. A coluna que o comprador usa para saber o que mudou recentemente
-- virou "todos, hoje", em toda instalacao, sem desfazer.
--
-- ⚠️ E `set atualizado_em = atualizado_em` NAO resolve — o gatilho e `before update` e sobrescreve
-- o valor depois, de qualquer jeito. A unica forma honesta e desligar o gatilho para esta
-- instrucao. O par abaixo e seguro por tres razoes, nesta ordem:
--   1. o arquivo inteiro roda dentro de UMA transacao (o aplicador de migrations abre e fecha uma
--      por arquivo), entao qualquer falha reverte tambem o `disable` — nao existe estado em que o
--      gatilho fique desligado;
--   2. o `alter table … disable trigger` toma SHARE ROW EXCLUSIVE em `contatos` ate o `commit`
--      — NAO e bloqueio exclusivo, e a diferenca importa para quem for reusar esta receita:
--      LEITURA continua fluindo o tempo todo (`select` pega ACCESS SHARE, que nao conflita).
--      O que fica barrado e a ESCRITA (ROW EXCLUSIVE), e e so ela que importa aqui: nenhuma
--      outra sessao — o container antigo, que o EasyPanel mantem servindo durante a
--      reconstrucao — consegue gravar contato com o gatilho desligado. Nao ha janela de ESCRITA;
--   3. ele NAO pede privilegio novo: `alter table` exige ser dono da tabela, exatamente como o
--      `add column` da 0022, que ja rodou em toda instalacao viva.
--
-- `disable trigger contatos_set_atualizado`, nominal — NUNCA `disable trigger all`, que levaria
-- junto o gatilho criado acima e faria o backfill nao calcular coisa nenhuma.
alter table public.contatos disable trigger contatos_set_atualizado;

-- 🔴 `is distinct from` faz as DUAS coisas, e a segunda e a metade esquecida:
--   · re-executavel — o boot reaplica migration pendente, e a segunda passada casa ZERO linhas;
--   · limpa sufixo LIXO — a linha que perdeu o telefone (ou que guarda um identificador que a
--     regra de hoje recusa) fica com o sufixo antigo apontando para uma pessoa. `is distinct from`
--     alcanca o par (`null`, valor) que um `<>` deixaria passar calado.
update public.contatos
   set telefone_sufixo = public.sufixo_telefone(telefone)
 where telefone_sufixo is distinct from public.sufixo_telefone(telefone);

alter table public.contatos enable trigger contatos_set_atualizado;
