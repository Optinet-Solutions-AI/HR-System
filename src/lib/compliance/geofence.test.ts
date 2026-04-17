/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isWithinOffice } from './geofence'
import {
  OFFICE_GPS,
  REDVERS_WRONG_GPS,
  TINA_NEAR_GPS,
  FAR_AWAY_GPS,
  makeOfficeLocation,
} from '@/lib/test-utils/factories'

// ---------------------------------------------------------------------------
// isWithinOffice — pure GPS math with real Turf.js (no mocking)
// ---------------------------------------------------------------------------

describe('isWithinOffice', () => {
  const officeLat = OFFICE_GPS.lat
  const officeLng = OFFICE_GPS.lng
  const radius = 200 // meters

  it('returns true when clocking is at the exact office location', () => {
    expect(isWithinOffice(officeLat, officeLng, officeLat, officeLng, radius)).toBe(true)
  })

  it('returns true when clocking is within the radius (~50m away)', () => {
    // Shift latitude by ~50m north (approx 0.00045 degrees)
    const nearLat = officeLat + 0.00045
    expect(isWithinOffice(nearLat, officeLng, officeLat, officeLng, radius)).toBe(true)
  })

  it('returns false when clocking is outside the radius (~500m away)', () => {
    // Shift latitude by ~500m north (approx 0.0045 degrees)
    const farLat = officeLat + 0.0045
    expect(isWithinOffice(farLat, officeLng, officeLat, officeLng, radius)).toBe(false)
  })

  it('returns true at approximately the boundary distance', () => {
    // ~190m north (just inside 200m)
    const boundaryLat = officeLat + 0.0017
    expect(isWithinOffice(boundaryLat, officeLng, officeLat, officeLng, radius)).toBe(true)
  })

  // Edge case 5: Redvers wrong GPS — ~3.8km from Head Office
  it('returns false for Redvers GPS (35.887, 14.482) at 200m radius', () => {
    expect(
      isWithinOffice(REDVERS_WRONG_GPS.lat, REDVERS_WRONG_GPS.lng, officeLat, officeLng, radius)
    ).toBe(false)
  })

  // Edge case 15: Tina near GPS — ~900m from Head Office
  it('returns false for Tina GPS (35.914, 14.493) at 200m radius', () => {
    expect(
      isWithinOffice(TINA_NEAR_GPS.lat, TINA_NEAR_GPS.lng, officeLat, officeLng, radius)
    ).toBe(false)
  })

  it('returns true for Tina GPS when radius is increased to 1100m', () => {
    // Tina is ~1021m from office — 1100m radius captures her
    expect(
      isWithinOffice(TINA_NEAR_GPS.lat, TINA_NEAR_GPS.lng, officeLat, officeLng, 1100)
    ).toBe(true)
  })

  it('returns false for a clearly distant point', () => {
    expect(
      isWithinOffice(FAR_AWAY_GPS.lat, FAR_AWAY_GPS.lng, officeLat, officeLng, radius)
    ).toBe(false)
  })

  it('returns true for far-away point when radius is very large (50000m)', () => {
    expect(
      isWithinOffice(FAR_AWAY_GPS.lat, FAR_AWAY_GPS.lng, officeLat, officeLng, 50000)
    ).toBe(true)
  })

  it('handles zero radius — only exact match returns true', () => {
    expect(isWithinOffice(officeLat, officeLng, officeLat, officeLng, 0)).toBe(true)
    // Even 1m away should be false
    const tinyShift = officeLat + 0.00001
    expect(isWithinOffice(tinyShift, officeLng, officeLat, officeLng, 0)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getOfficeLocations — requires mocked Supabase admin client
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: vi.fn(),
}))

import { getOfficeLocations } from './geofence'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

describe('getOfficeLocations', () => {
  const mockFrom = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createAdminSupabaseClient).mockReturnValue({
      from: mockFrom,
    } as any)
  })

  it('returns active office locations from Supabase', async () => {
    const offices = [makeOfficeLocation()]
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: offices, error: null }),
      }),
    })

    const result = await getOfficeLocations()
    expect(result).toEqual(offices)
    expect(mockFrom).toHaveBeenCalledWith('office_locations')
  })

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection failed' } }),
      }),
    })

    await expect(getOfficeLocations()).rejects.toThrow('connection failed')
  })
})
