// GPS geofence validation using Turf.js
// Validates whether a clocking GPS coordinate is within
// the office geofence radius.

import * as turf from '@turf/turf'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types/database'

export type OfficeLocation = Database['public']['Tables']['office_locations']['Row']

export function isWithinOffice(
  clockingLat: number,
  clockingLng: number,
  officeLat: number,
  officeLng: number,
  radiusMeters: number
): boolean {
  const from = turf.point([clockingLng, clockingLat])
  const to = turf.point([officeLng, officeLat])
  const distance = turf.distance(from, to, { units: 'meters' })
  return distance <= radiusMeters
}

export async function getOfficeLocations(): Promise<OfficeLocation[]> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('office_locations')
    .select('*')
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  return data
}
