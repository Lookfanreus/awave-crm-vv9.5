export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ ok: true, api: 'awave-crm', version: 'v1' })
}
