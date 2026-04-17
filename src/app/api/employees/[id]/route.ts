import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const updateEmployeeSchema = z.object({
  office_days_per_week: z.number().int().min(0).max(5),
  role: z.enum(['employee', 'manager', 'hr_admin', 'super_admin']),
  notes: z.string().nullable(),
  is_active: z.boolean(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Role check — only hr_admin and super_admin can edit employees
  const { data: currentEmployee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentEmployee || !['hr_admin', 'super_admin'].includes(currentEmployee.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate route param
  const { id } = await params
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return Response.json({ error: 'Invalid employee ID' }, { status: 400 })
  }

  // Validate body
  const body = await request.json()
  const parsed = updateEmployeeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  // Update employee via admin client (bypasses RLS — auth/role already verified above)
  const adminSupabase = createAdminSupabaseClient()
  const { data, error } = await adminSupabase
    .from('employees')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ data })
}
