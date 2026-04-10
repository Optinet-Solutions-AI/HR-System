import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const addHolidaySchema = z.object({
  date: z.string().date(),
  name: z.string().min(1, 'Name is required'),
})

async function requireHrAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 } as const

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin'].includes(employee.role)) {
    return { error: 'Forbidden', status: 403 } as const
  }

  return { error: null, status: 200 } as const
}

export async function GET() {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .order('date', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

export async function POST(request: Request) {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
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
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ data }, { status: 201 })
}
