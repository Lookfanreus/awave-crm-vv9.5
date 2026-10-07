



export function erroV1(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ error: { ...extra, code, message } }, { status })
}
