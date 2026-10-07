# syntax=docker/dockerfile:1

# ---- deps: instala com o lockfile ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: Next standalone ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 🔴 MASTRA_TELEMETRY_DISABLED TAMBEM AQUI, E NAO SO NO ESTAGIO DE EXECUCAO. A telemetria do
# `@mastra/core` e OPT-OUT e o cliente dela vem em `dependencies`, com chave e host cravados; o
# `next build` CARREGA os modulos de servidor para ler os `export const` das rotas, entao o
# codigo do assistente e importado durante a construcao. E a construcao roda na maquina do
# comprador, no painel dele, com a rede aberta. Desligar so na execucao cobria metade do
# caminho — e a metade que faltava e a que roda antes de qualquer instalacao existir.
ENV NEXT_TELEMETRY_DISABLED=1 MASTRA_TELEMETRY_DISABLED=1
# NAO declare ARG/ENV de NEXT_PUBLIC_* aqui. O Next INLINA toda NEXT_PUBLIC_* presente
# no process.env de build — inclusive na compilacao do SERVER — e o `?? process.env.X`
# some por constant-folding. Pior: `ENV X=$X` com ARG nao passado grava "" e, como
# "" != null, o Next inlina a string vazia e o fallback de runtime NUNCA acontece.
# O CRM le a config so em runtime (SUPABASE_URL / SUPABASE_ANON_KEY /
# SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL).
# auditoria:ok secao — a secao citada abaixo e do guia de instalacao, que viaja no zip junto.
# Ver docs/DEPLOY.md §2.

# Dependencias da ZONA do comprador (custom/package.json), se ele tiver criado uma.
#
# npm --prefix DE PROPOSITO, pelo mesmo motivo do estagio `migrate-deps` acima: da um
# `custom/node_modules` FLAT, que a resolucao de modulo do Node encontra sozinha a partir dos
# arquivos dele — sem tocar no package.json nem no pnpm-lock.yaml do produto, que continuam
# sob --frozen-lockfile e sob o manifesto. Sem isto, "faca o que quiser na sua pasta" na
# pratica seria "faca o que quiser desde que seja `fetch`": instalar um SDK exigiria editar o
# package.json, que e arquivo do PRODUTO e e sobrescrito na proxima atualizacao.
#
# `|| true` nao e desleixo: a zona nao pode impedir o build, e a atualizacao em 1 clique
# PASSA por este build. Um package.json torto dele vira dependencia ausente em runtime (erro
# contido na tela dele), nunca um container que nao sobe.
RUN if [ -f custom/package.json ]; then npm install --prefix custom --no-audit --no-fund || true; fi

RUN pnpm build

# ---- migrate-deps: a UNICA dep do migrate.mjs (postgres, zero deps transitivas).
#      NPM de proposito: da um dir FLAT (sem symlink do pnpm) e o standalone do Next
#      nao traca o migrate.mjs (nao e importado pelo app) — copiamos a dep na mao. ----
FROM node:22-bookworm-slim AS migrate-deps
WORKDIR /deps
RUN npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund postgres@3

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
# libcap2-bin -> setcap: da ao node a capability de ligar na porta 80 SEM root
# (EasyPanel aponta o dominio pra 80). O app roda como `node` (nao-root).
# git + ca-certificates -> a atualizacao em 1 clique commita e da push no repositorio
# GitHub do proprio comprador; sem o binario `git` isso e FISICAMENTE impossivel dentro do
# container, e sem `ca-certificates` o push por HTTPS falha na verificacao do certificado.
# Entram AGORA, antes de a maquina de update existir, de proposito: o artefato entregue ao
# primeiro comprador ja nasce capaz de se atualizar. Se entrassem depois, todo mundo que ja
# instalou precisaria de UMA ultima atualizacao manual so pra ganhar o `git` — o ovo-e-galinha
# classico de bootstrap de auto-update, por um canal que nao existe.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libcap2-bin git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(command -v node)")"
# 🔴 MASTRA_TELEMETRY_DISABLED nao e zelo: o `@mastra/core` traz o cliente do PostHog em
# `dependencies` (nao opcional), com a chave de API e o host CRAVADOS no codigo, e a telemetria
# dele e OPT-OUT — `if (!process.env.MASTRA_TELEMETRY_DISABLED) return true`. O bundle do Next
# INLINA esse cliente no chunk de servidor que a rota `/api/interno/tick` carrega, e essa rota e
# batida a cada ~30s em TODA instalacao.
#
# Hoje ele nao dispara: foi medido (zero saidas de rede ao importar e construir o Agent), porque o
# tree-shaking deixou um unico call-site vivo e ele comeca com `if (!fgaProvider) return`. Mas quem
# nos protege e o tree-shaking mais um `if` de terceiro — nao uma decisao nossa. Uma minor do
# Mastra que mova a captura para o construtor liga telemetria em 581 instalacoes SEM UMA LINHA DE
# DIFF no nosso codigo: so o pnpm-lock.yaml mudaria.
#
# O produto se vende como "roda offline forever". Fechar a porta antes de alguem abri-la custa esta
# linha.
ENV NODE_ENV=production PORT=80 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 MASTRA_TELEMETRY_DISABLED=1 TELEGRAM_ENABLED=0
# saida standalone do Next (server.js em /app/server.js)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# runner de migrations: SQL + a unica dep dele (fora do trace do standalone).
# migrate.mjs resolve `supabase/migrations` relativo a import.meta.url (== /app) — layout bate.
COPY --from=build /app/supabase/migrations ./supabase/migrations
COPY --from=migrate-deps /deps/node_modules/postgres ./node_modules/postgres
# entrypoint + migrate.mjs vem do CONTEXTO (raiz). Invocado via `sh` (Windows nao preserva +x).
COPY docker-entrypoint.sh migrate.mjs config-deploy.mjs preflight.mjs preflight-adocao.mjs preflight-vector.mjs heartbeat-tick.mjs ./
# Zona do comprador. O migrate.mjs JA procurava `custom/migrations` (e tolera ENOENT), mas
# a pasta nunca era copiada — a capacidade existia e era inerte: um comprador que criasse
# uma migration propria veria ela ser silenciosamente ignorada dentro do container.
COPY custom ./custom
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "const p=process.env.PORT||80;require('http').get('http://127.0.0.1:'+p+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
USER node
CMD ["sh", "/app/docker-entrypoint.sh"]
