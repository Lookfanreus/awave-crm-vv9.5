


export function popupEraDonoDoFoco(foco: unknown, corpo: unknown, focoEstaNoPopup: boolean): boolean {
  if (foco === null || foco === undefined) return true
  if (foco === corpo) return true
  return focoEstaNoPopup
}
