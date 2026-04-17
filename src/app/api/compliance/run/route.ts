import { z } from 'zod'
import { requireHrAdmin } from '@/lib/auth/require-hr-admin'
import { runCompliance } from '@/lib/compliance/engine'

const schema = z.object({
  from: z.string().date(),
  to: z.string().date(),
})

export async function POST(request: Request) {
  const auth = await requireHrAdmin()
  if (auth.error) {
    return Response.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { from, to } = parsed.data
  if (from > to) {
    return Response.json({ error: '`from` must not be after `to`' }, { status: 400 })
  }

  try {
    const result = await runCompliance(from, to)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[compliance/run]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
