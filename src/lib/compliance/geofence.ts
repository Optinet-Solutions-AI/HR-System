// GPS geofence validation using Turf.js
// Validates whether a clocking GPS coordinate is within
// the office geofence radius.

import * as turf from '@turf/turf'

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
