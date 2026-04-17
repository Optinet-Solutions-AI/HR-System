import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { requireHrAdmin } from '@/lib/auth/require-hr-admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ error: 'Invalid holiday ID' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('public_holidays')
    .delete()
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // PGRST116 = no rows returned (not found)
    if (error.code === 'PGRST116') {
      return Response.json({ error: 'Holiday not found' }, { status: 404 })
    }
    console.error('[DELETE /api/holidays/:id]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  return Response.json({ data })
}
