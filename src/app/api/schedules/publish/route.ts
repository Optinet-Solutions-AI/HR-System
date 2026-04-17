import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const publishSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // HR-only
  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin'].includes(employee.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate body
  const body = await request.json()
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { month, year } = parsed.data

  // Insert lock — ignore conflict so re-publishing the same month is idempotent
  const { error } = await supabase
    .from('schedule_locks')
    .upsert({ month, year, locked_by: employee.id }, { onConflict: 'month,year' })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const label = `${year}-${String(month).padStart(2, '0')}`
  return Response.json({ data: { published: true, month: label } })
}
