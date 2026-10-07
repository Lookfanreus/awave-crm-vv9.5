// PURO e DETERMINÍSTICO — coração node-testável do lado App do licenciamento open-core.
// `now` é injetado (epoch ms). Sem Date.now / Math.random / I/O / imports de servidor.
// O estado retornado vai gatear "conteúdo vivo" numa fatia FUTURA — não aqui.

export type LicenseCache = {
  hub_status: "active" | "revoked" | "in_use_elsewhere";
  buyer_name?: string;
  latest_version?: string;   // última versão disponível no Hub (payload p/ o card de update; NÃO afeta o estado)
  club_incluso_ate?: string; // ISO (ausente em revoked e in_use_elsewhere)
  entitled?: boolean;        // direito ao firehose DITADO PELO HUB (cascata de reseller já resolvida). `false` corta mesmo com janela local futura.
  last_ok_at: string;        // ISO
  hard_block?: boolean;      // true = revogada por reembolso DENTRO da garantia (7d). BRICKA o engine. Vem do `block:'hard'` do /validate.
} | null;

export type LicenseState = "never_verified" | "revoked" | "in_use_elsewhere" | "expired" | "active" | "unverified";

export const GRACE_MS = 5 * 24 * 60 * 60 * 1000;

export function getLicenseState(cache: LicenseCache, now: number): LicenseState {
  if (!cache) return "never_verified";
  if (cache.hub_status === "revoked") return "revoked";
  if (cache.hub_status === "in_use_elsewhere") return "in_use_elsewhere"; // antes de expired: nao vem club_incluso_ate
  // Direito ao firehose DITADO PELO HUB, e o App NÃO recalcula: `resolveOwnerContext`
  // (lado Hub) já resolveu a cascata de reseller, então `entitled:false` corta MESMO com
  // a janela local ainda no futuro — fecha o buraco do filho cujo fornecedor (pai) deixou
  // a assinatura vencer (e também o install "flagged"/quarentenado, que o Hub devolve com
  // entitled:false).
  // Ausente (Hub/cache antigo) → cai no check de janela local abaixo (compat total).
  if (cache.entitled === false) return "expired";
  if (!cache.club_incluso_ate || Date.parse(cache.club_incluso_ate) <= now) return "expired";
  if (now - Date.parse(cache.last_ok_at) <= GRACE_MS) return "active";
  return "unverified";
}

export function firehoseOn(s: LicenseState): boolean {
  return s === "active";
}

/**
 * Firehose disponível INCLUINDO a graça offline de 5d (`unverified`): a régua
 * ÚNICA que gateia TODO firehose — Loja/catálogo E o card de Atualizações — pra
 * os dois nunca discordarem sobre "dá pra falar com o Hub?". `active` = Hub
 * confirmou recentemente; `unverified` = clube ainda válido, mas offline além da
 * graça (fail-open). Fora disso (never_verified/expired/revoked/in_use_elsewhere)
 * NÃO há canal vivo — quem consome não pode afirmar nada vindo do Hub.
 */
export function firehoseGraced(s: LicenseState): s is "active" | "unverified" {
  return s === "active" || s === "unverified";
}

/**
 * A Loja é firehose: o catálogo do Hub E a criação de agente "sob medida" só
 * liberam com licença viva — inclui a graça offline `unverified` (5d), espelhando
 * o `storeAllowed` de selectLojaBanner (mesma régua p/ card e catálogo não driftarem).
 * A REVISÃO de um funcionário JÁ contratado NÃO passa por aqui: o Motor nunca
 * tranca o que já é do comprador (decisão do dono 2026-07-11).
 */
export function lojaLiberada(s: LicenseState): s is "active" | "unverified" {
  return firehoseGraced(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE GATE — o ÚNICO caminho que PARA o engine (ortogonal a firehose*/loja*).
//
// Open-core: o engine roda pra sempre, offline, sem gate de licença — EXCETO um
// caso travado (Nathan, 2026-07-14): reembolso DENTRO da garantia de 7 dias vira
// BRICK duro. O soft (assinatura vencida / reembolso fora dos 7d) NÃO passa por
// aqui: continua rodando, só o firehose (Loja/updates) fecha via getLicenseState.
//
// Duas fontes de bloqueio:
//   1. `hard` — o Hub confirmou a revogação-na-garantia (`cache.hard_block`). Brick real.
//   2. `stale` — kill-switch offline: enquanto o install é JOVEM (garantia + folga),
//      se ficou muito tempo sem validar com sucesso, força religar/revalidar. É o que
//      impede o fraudador de reembolsar no dia 3 e ficar offline pra sempre com o cache
//      `active`. RECUPERÁVEL: revalidou e ainda vivo → `last_ok_at` refresca → destrava;
//      só o revogado (que revalida p/ `revoked`/`hard`) segue preso.
// Install MADURO (passou YOUNG_MS) nunca é candidato a `stale` — quem pagou fica a salvo.
// ─────────────────────────────────────────────────────────────────────────────

/** Janela "jovem" do install (garantia de 7d + folga). Fora dela o kill-switch relaxa. */
export const YOUNG_MS = 14 * 24 * 60 * 60 * 1000;
/** Máx. sem validar com SUCESSO antes do kill-switch (install jovem) forçar phone-home.
 *  >> intervalo do heartbeat (300s), então fechar o app à noite nunca dispara. */
export const FRESH_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export type EngineBlockReason = "hard" | "stale";

/**
 * Motivo do bloqueio do engine, ou `null` se liberado. PURO/DETERMINÍSTICO (`now`
 * injetado, epoch ms) — o caller (I/O que lê cache/first_activated_at) é quem faz o
 * FAIL-OPEN: em QUALQUER erro de leitura, trate como `null` (nunca brique por bug).
 */
export function engineBlockReason(
  cache: LicenseCache,
  firstActivatedAt: number | null,
  now: number,
): EngineBlockReason | null {
  if (cache?.hard_block === true) return "hard"; // revoke-na-garantia confirmado
  // Kill-switch: install jovem + validação stale → força revalidar (recuperável).
  if (
    firstActivatedAt != null &&
    now - firstActivatedAt <= YOUNG_MS &&
    cache != null &&
    now - Date.parse(cache.last_ok_at) > FRESH_STALE_MS
  ) {
    return "stale";
  }
  return null;
}

/** Boolean do gate do engine — `= engineBlockReason(...) !== null`. */
export function engineBlocked(
  cache: LicenseCache,
  firstActivatedAt: number | null,
  now: number,
): boolean {
  return engineBlockReason(cache, firstActivatedAt, now) !== null;
}
