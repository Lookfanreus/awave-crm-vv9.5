-- 0062_requeue_midia_uazapi.sql — devolve à fila a mídia que o bug da UAZAPI matou.
--
-- 🔴 POR QUE ESTA MIGRATION EXISTE. Até a v0.9.1 o dreno de mídia baixava a `refExterna` que
-- vinha no envelope do webhook. Na UAZAPI ela aponta para a CDN do WhatsApp
-- (`mmg.whatsapp.net/…enc`): outro host — recusado pela allowlist do download, que só autoriza
-- o host do `server_url` do canal — e, ainda que passasse, um arquivo cifrado. Resultado: TODA
-- mídia recebida por UAZAPI virava `erro`. E `erro` é TERMINAL: o índice parcial da fila
-- (`mensagens_midia_pendente_idx`) e o predicado de `reservar_midias` só enxergam `pendente`.
--
-- Sem esta migration o conserto do código só vale para o que chegar DEPOIS da atualização: as
-- conversas antigas continuariam mostrando "Não foi possível baixar o arquivo" para sempre, e
-- o comprador leria isso como "a atualização não resolveu".
--
-- ⚠️ ADITIVA: não cria, não altera e não remove estrutura nenhuma. É só dado, e só num sentido
-- (`erro` → `pendente`), o que a torna segura de rodar mais de uma vez — a segunda passada não
-- acha mais nada com `status = 'erro'` naquele recorte.

-- 🔴 O RECORTE DE 30 DIAS É DELIBERADO, e o motivo não é performance.
--
-- `POST /message/download` pede o arquivo à instância do comprador, que o busca no WhatsApp.
-- **Não sabemos** por quanto tempo uma mensagem antiga continua resolvível — isso depende do
-- provider e do aparelho pareado, e não é coisa que se descubra lendo código. O que sabemos é
-- o custo de errar para o lado largo: cada linha devolvida à fila ocupa o braço de mídia (uma
-- resolução + um download, até 30 s) e, se falhar, gasta as três tentativas antes de voltar a
-- `erro`. Numa instalação com meses de conversa isso seguraria a mídia NOVA atrás de um
-- retrabalho que provavelmente não dá em nada.
--
-- 30 dias recupera o histórico que alguém ainda vai abrir, com trabalho limitado. Quem quiser
-- ir além pode repetir o `update` à mão trocando o intervalo — e é exatamente por isso que ele
-- está escrito de forma legível, e não escondido atrás de uma função.
update public.mensagens m
   set midia = (m.midia - 'tentativas' - 'reservadaAte') || jsonb_build_object('status', 'pendente')
  from public.conversas c
  join public.canais ca on ca.id = c.canal_id
 where m.conversa_id = c.id
   -- Só o canal que tinha o defeito. O oficial (Cloud API) baixa a URL do envelope sem
   -- problema nenhum: uma mídia em `erro` lá falhou por outro motivo, e devolvê-la à fila
   -- seria retentar uma falha que já se provou definitiva.
   and ca.provider = 'uazapi'
   and m.midia is not null
   and m.midia->>'status' = 'erro'
   and m.criado_em > now() - interval '30 days';

-- 🔴 `- 'tentativas'` E `- 'reservadaAte'` NÃO SÃO FAXINA.
--
-- A linha chegou a `erro` porque estourou `TETO_TENTATIVAS`. Devolvê-la a `pendente` mantendo
-- o contador faz o dreno desistir dela na PRIMEIRA falha — e a primeira falha é provável
-- (rede, link ainda não gerado). Sem zerar, esta migration entregaria uma tentativa por linha
-- em vez das três, e o comprador veria a mesma tela de novo.
--
-- O carimbo de reserva sai pelo mesmo motivo: uma reserva velha, deixada para trás por um
-- container que morreu no meio, seguraria a linha fora da fila até a janela vencer.
