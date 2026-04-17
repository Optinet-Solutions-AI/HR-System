import { createServerSupabaseClient } from '@/lib/supabase/server'
import { syncClockings } from '@/lib/talexio/sync'
import { z } from 'zod'

const bodySchema = z.object({
  date: z.string().date().optional(),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin'].includes(employee.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let date: string
  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    date = parsed.data.date ?? todayMalta()
  } catch {
    date = todayMalta()
  }

  try {
    const result = await syncClockings(date)
    return Response.json({ date, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[sync/trigger]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

function todayMalta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(new Date())
}
