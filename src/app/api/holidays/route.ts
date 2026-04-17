import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { requireHrAdmin } from '@/lib/auth/require-hr-admin'

const addHolidaySchema = z.object({
  date: z.string().date(),
  name: z.string().min(1, 'Name is required'),
})

export async function GET() {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.client!
    .from('public_holidays')
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    console.error('[GET /api/holidays]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
  return Response.json({ data })
}

export async function POST(request: Request) {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = addHolidaySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('public_holidays')
    .insert({ date: parsed.data.date, name: parsed.data.name })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'A holiday on that date already exists.' }, { status: 409 })
    }
    console.error('[POST /api/holidays]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  return Response.json({ data }, { status: 201 })
}
