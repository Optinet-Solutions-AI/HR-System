import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const schema = z.object({
  override_reason: z.string().min(1, 'override_reason is required'),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch current employee (id + role)
  const { data: currentEmployee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentEmployee) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Fetch compliance record to get its employee_id
  const { data: record, error: fetchError } = await supabase
    .from('compliance_records')
    .select('id, employee_id')
    .eq('id', id)
    .single()

  if (fetchError || !record) {
    return Response.json({ error: 'Compliance record not found' }, { status: 404 })
  }

  // Authorization: hr_admin / super_admin always allowed;
  // manager allowed only if they manage the employee's team
  const isAdmin = ['hr_admin', 'super_admin'].includes(currentEmployee.role)

  if (!isAdmin) {
    // Check if current user manages the team the target employee belongs to.
    // !inner join: returns null when employee has no team, so managerOf is false.
    const { data: teamRow } = await supabase
      .from('employees')
      .select('teams!inner(manager_id)')
      .eq('id', record.employee_id)
      .single()

    const managerOf =
      (teamRow as { teams: { manager_id: string } | null } | null)?.teams
        ?.manager_id === currentEmployee.id

    if (!managerOf) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Parse body
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

  const { override_reason } = parsed.data

  const { data: updated, error: updateError } = await supabase
    .from('compliance_records')
    .update({
      is_compliant: true,
      override_reason,
      reviewed_by: currentEmployee.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    console.error('[compliance/override]', updateError.message)
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json({ data: updated })
}
