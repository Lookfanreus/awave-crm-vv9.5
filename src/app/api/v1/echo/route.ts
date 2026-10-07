import { autenticarRota } from '@/server/api/autenticar-rota'

export const dynamic = 'force-dynamic'


export async function POST(req: Request) {
  const auth = await autenticarRota(req)
  if (auth instanceof Response) return auth
  return Response.json({ data: { workspace_id: auth.workspaceId, echo: auth.raw.length } })
}
