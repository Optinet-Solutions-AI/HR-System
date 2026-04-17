// src/lib/talexio/sync.ts
// Pulls clockings from Talexio, maps talexio_id → employee_id, and upserts
// into the clockings table via the admin client (bypasses RLS).
// Called by /api/cron/sync-talexio and /api/sync/trigger.

import { fetchClockings } from './client'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export interface SyncResult {
  synced: number
  new: number
  errors: string[]
}

export async function syncClockings(date: string): Promise<SyncResult> {
  const supabase = createAdminSupabaseClient()
  const errors: string[] = []

  // 1. Fetch clockings from Talexio for the given date
  const clockings = await fetchClockings(date)

  // 2. Build talexio_id → internal employee UUID map (active employees only)
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, talexio_id')
    .eq('is_active', true)

  if (empError) {
    throw new Error(`[sync] Failed to fetch employees: ${empError.message}`)
  }

  const talexioIdToEmployeeId = new Map(
    employees
      .filter(e => e.talexio_id != null)
      .map(e => [e.talexio_id, e.id])
  )

  // 3. Fetch existing clockings for this date to distinguish new vs updated records
  const { data: existingClockings, error: existingError } = await supabase
    .from('clockings')
    .select('employee_id')
    .eq('date', date)

  if (existingError) {
    throw new Error(`[sync] Failed to fetch existing clockings: ${existingError.message}`)
  }

  const existingEmployeeIds = new Set(existingClockings.map(c => c.employee_id))

  // 4. Upsert each clocking — skip records with no matching employee
  let synced = 0
  let newCount = 0

  for (const clocking of clockings) {
    const employeeId = talexioIdToEmployeeId.get(clocking.employee_code)

    if (!employeeId) {
      console.warn(
        `[sync] Unknown talexio_id "${clocking.employee_code}" (${clocking.employee_name}) on ${date} — skipping`
      )
      errors.push(`Unknown employee: ${clocking.employee_code} (${clocking.employee_name})`)
      continue
    }

    const { error: upsertError } = await supabase
      .from('clockings')
      .upsert(
        {
          employee_id: employeeId,
          date: clocking.date,
          day_of_week: clocking.day_of_week,
          time_in: clocking.time_in ?? null,
          time_out: clocking.time_out ?? null,
          hours_worked: clocking.hours_worked ?? null,
          location_in_name: clocking.location_in_name ?? null,
          location_in_lat: clocking.location_in_lat ?? null,
          location_in_lng: clocking.location_in_lng ?? null,
          location_out_name: clocking.location_out_name ?? null,
          location_out_lat: clocking.location_out_lat ?? null,
          location_out_lng: clocking.location_out_lng ?? null,
          clocking_status: clocking.clocking_status,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id,date' }
      )

    if (upsertError) {
      const msg = `Failed to upsert ${clocking.employee_code} on ${date}: ${upsertError.message}`
      console.error(`[sync] ${msg}`)
      errors.push(msg)
      continue
    }

    synced++
    if (!existingEmployeeIds.has(employeeId)) newCount++
  }

  return { synced, new: newCount, errors }
}
