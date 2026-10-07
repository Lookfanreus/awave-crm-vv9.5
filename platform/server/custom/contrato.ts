// platform/server/custom/contrato.ts — Tier B (template CRM, NÃO byte-gated).
// Contém SÓ o AuthDescriptor que verificarAssinatura.ts (Tier A verbatim) importa.
// O conjunto é FECHADO de propósito: a segurança mora no verificador, não neste tipo.
// Acrescentar uma variante aqui sem casar com o verificador (que é byte-gated e não se edita
// deste lado) produz um descritor que compila e nunca autentica.
export type AuthDescriptor =
  | { tipo: 'hmac'; em: 'header'; header: string; encoding: 'hex' | 'base64'; segredo: string; prefixo?: string }
  | { tipo: 'token'; em: 'header'; header: string; segredo: string }
  | { tipo: 'token'; em: 'query'; param: string; segredo: string }
