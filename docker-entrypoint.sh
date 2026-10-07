#!/bin/sh
set -e
# Pré-voo: 0 = normal, 2 = modo diagnóstico, 1 = não sobe (ver preflight.mjs).
# `set -e` mataria o script no exit != 0, então desarmamos só nesta chamada.
set +e
node preflight.mjs
PREFLIGHT=$?
set -e

if [ "$PREFLIGHT" = "1" ]; then
  exit 1   # EasyPanel mantém o container antigo servindo
fi

if [ "$PREFLIGHT" = "2" ]; then
  # Modo diagnóstico SÓ EXPLICA, nunca muta: não rodamos migrations. A prova de banco
  # virgem pode ter vindo do banco ERRADO — uma credencial apontando pro projeto de outra
  # pessoa —, e criar 13 migrations num banco alheio seria pior que o problema que estamos
  # mostrando.
  export AWAVE_MODO=diagnostico
  exec node server.js
fi

# Migrations pendentes ANTES do server (no-op sem SUPABASE_DB_URL). migrate.mjs é
# verbatim do Motor e continua sendo o ÚNICO dono do exit 1 por problema de banco.
node migrate.mjs

# Heartbeat: LIGADO por default (`:-1`), igual ao Motor. Ele NÃO é só o escoador do outbox de
# webhooks — é também o único caminho automático que revalida a licença (`baterLicenca`, com
# relógio próprio de 6h, em src/server/license/batida.ts) e o que roda as automações.
#
# 🔴 Por que o default importa: o engine-gate bloqueia o shell inteiro por `stale` quando um
# install JOVEM (<14 dias) passa >3 dias sem confirmar a licença. Quem refresca esse relógio é
# `revalidarLicenca()`, e fora das ações manuais do /config quem a chama é este heartbeat. Com o
# default DESLIGADO (como estava), o comprador que seguiu o docs/DEPLOY.md à risca — que nunca
# citou esta variável — era trancado a cada 3 dias, e um membro que não é dono do deploy não
# tinha como destravar. Herdamos do Motor um kill-switch que pressupõe que algo telefona pra
# casa; aqui nada telefonava.
#
# Quem quiser desligar mesmo assim continua podendo: HEARTBEAT_ENABLED=0.
if [ "${HEARTBEAT_ENABLED:-1}" = "1" ]; then
  export TICK_SECRET="${TICK_SECRET:-$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")}"
  node heartbeat-tick.mjs &
fi
exec node server.js
