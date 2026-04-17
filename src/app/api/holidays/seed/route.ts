// src/app/api/holidays/seed/route.ts
import { requireHrAdmin } from '@/lib/auth/require-hr-admin'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

const MALTA_2026_HOLIDAYS = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-10', name: "Feast of St Paul's Shipwreck" },
  { date: '2026-03-19', name: 'Feast of St Joseph' },
  { date: '2026-03-31', name: 'Freedom Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: "Workers' Day" },
  { date: '2026-06-07', name: 'Sette Giugno' },
  { date: '2026-06-29', name: 'Feast of St Peter and St Paul' },
  { date: '2026-08-15', name: 'Feast of the Assumption' },
  { date: '2026-09-08', name: 'Victory Day' },
  { date: '2026-09-21', name: 'Independence Day' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception' },
  { date: '2026-12-13', name: 'Republic Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
]

export async function POST() {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('public_holidays')
    .upsert(MALTA_2026_HOLIDAYS, { onConflict: 'date', ignoreDuplicates: true })
    .select()

  if (error) {
    console.error('[POST /api/holidays/seed]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  return Response.json({ data: { inserted: data?.length ?? 0 } })
}
