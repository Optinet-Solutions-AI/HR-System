// src/lib/talexio/client.ts
import { z } from 'zod'

// ─── Schema ─────────────────────────────────────────────────────────────────────
// Models the Talexio REST API response.
// Optional fields are nullish() because real clockings have broken records:
// no punch-out, no GPS lock, or system errors — all documented in SPEC.md.

export const TalexioClockingSchema = z.object({
  employee_code:     z.string(),
  employee_name:     z.string(),
  date:              z.string(),
  day_of_week:       z.string(),
  time_in:           z.string().nullish(),
  time_out:          z.string().nullish(),
  hours_worked:      z.number().nullish(),
  location_in_name:  z.string().nullish(),
  location_in_lat:   z.number().nullish(),
  location_in_lng:   z.number().nullish(),
  location_out_name: z.string().nullish(),
  location_out_lat:  z.number().nullish(),
  location_out_lng:  z.number().nullish(),
  clocking_status:   z.string(),
  job_schedule:      z.string().nullish(),
  unit:              z.string().nullish(),
  business_unit:     z.string().nullish(),
})

export const TalexioResponseSchema = z.array(TalexioClockingSchema)

export type TalexioClocking = z.infer<typeof TalexioClockingSchema>

// ─── Error ───────────────────────────────────────────────────────────────────────

export class TalexioApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'TalexioApiError'
  }
}

// ─── Mock data ──────────────────────────────────────────────────────────────────
// Used when TALEXIO_API_URL is not set (local dev, CI without credentials).
// Employee data from SPEC.md. Edge cases preserved:
//   Niwi01 — no clocking (frequently "No clocking" in Daily Reports)
//   Tiko01 — broken clocking (time_in present, time_out null)
//   Rewh01 — wrong GPS location (~3.8km from office, per SPEC Section 9)

const OFFICE_LAT = 35.9222072
const OFFICE_LNG = 14.4878368

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

function getDayOfWeek(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return DAY_NAMES[new Date(year, month - 1, day).getDay()]
}

type MockEmployee = Omit<TalexioClocking, 'date' | 'day_of_week'>

const MOCK_EMPLOYEES: MockEmployee[] = [
  // ── 5 office days ─────────────────────────────────────────────────────────────
  {
    employee_code: 'Niwi01', employee_name: 'Niklas Wirth',
    job_schedule: 'Full Time 40Hrs', unit: 'Management', business_unit: 'Operations',
    // No clocking — per SPEC, Niklas frequently has "No clocking" in Daily Reports.
    // clocking_status is 'Active Clocking' to match what Talexio emits when an
    // employee has no punch data. The compliance engine detects absence via
    // time_in === null, not via clocking_status.
    time_in: null, time_out: null, hours_worked: null,
    location_in_name: null, location_in_lat: null, location_in_lng: null,
    location_out_name: null, location_out_lat: null, location_out_lng: null,
    clocking_status: 'Active Clocking',
  },
  {
    employee_code: 'Moal01', employee_name: 'AlJebali Mohamed',
    job_schedule: 'Full Time 40Hrs', unit: 'Content', business_unit: 'Content',
    time_in: '08:30', time_out: '17:30', hours_worked: 8.75,
    location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
    location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
    clocking_status: 'Active Clocking',
  },
  {
    employee_code: 'Yari01', employee_name: 'Ridene Yassine',
    job_schedule: 'Full Time 40Hrs', unit: 'Sports', business_unit: 'Sports',
    time_in: '09:00', time_out: '18:00', hours_worked: 8.5,
    location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
    location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
    clocking_status: 'Active Clocking',
  },
  {
    employee_code: 'Yoay01', employee_name: 'Ayedi Youssef',
    job_schedule: 'Full Time 40Hrs', unit: 'Sports', business_unit: 'Sports',
    time_in: '08:45', time_out: '17:45', hours_worked: 8.75,
    location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
    location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
    clocking_status: 'Active Clocking',
  },
  {
    employee_code: 'Esri01', employee_name: 'Ridene Esam',
    job_schedule: 'Full Time 40Hrs', unit: 'Sports', business_unit: 'Sports',
    time_in: '09:00', time_out: '18:00', hours_worked: 8.5,
    location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
    location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
    clocking_status: 'Active Clocking',
  },
  // ── 4 office days ─────────────────────────────────────────────────────────────
  {
    employee_code: 'Adsu01', employee_name: 'Svardal Ada',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    time_in: '09:00', time_out: '18:00', hours_worked: 8.5,
    location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
    location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
    clocking_status: 'Active Clocking',
  },
  {
    employee_code: 'Jasa01', employee_name: 'Santangelo Janice',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    time_in: '08:50', time_out: '17:50', hours_worked: 8.58,
    location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
    location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
    clocking_status: 'Active Clocking',
  },
  {
    employee_code: 'Owor01', employee_name: 'Ordway Owen',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    time_in: '08:55', time_out: '18:05', hours_worked: 8.75,
    location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
    location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
    clocking_status: 'Active Clocking',
  },
  {
    // Wrong-location edge case — per SPEC Section 9: ~3.8km from office on April 7
    employee_code: 'Rewh01', employee_name: 'Whitehead Redvers Lewis',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    time_in: '09:10', time_out: '18:10', hours_worked: 8.42,
    location_in_name: null, location_in_lat: 35.88758842, location_in_lng: 14.48299381,
    location_out_name: null, location_out_lat: 35.88758842, location_out_lng: 14.48299381,
    clocking_status: 'Active Clocking',
  },
  {
    employee_code: 'Sado01', employee_name: 'Dolce Salvatore',
    job_schedule: 'Full Time 40Hrs', unit: 'Management', business_unit: 'Operations',
    time_in: '09:00', time_out: '18:00', hours_worked: 8.5,
    location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
    location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
    clocking_status: 'Active Clocking',
  },
  {
    // Broken clocking edge case — per SPEC Section 9: time_in set, time_out null.
    // Clock-in GPS is ~990m from office (35.914, 14.493) — outside the 200m geofence.
    employee_code: 'Tiko01', employee_name: 'Koepf Tina',
    job_schedule: 'Full Time 40Hrs', unit: 'Content', business_unit: 'Content',
    time_in: '09:05', time_out: null, hours_worked: null,
    location_in_name: null, location_in_lat: 35.9145984, location_in_lng: 14.4935334,
    location_out_name: null, location_out_lat: null, location_out_lng: null,
    clocking_status: 'Broken clocking',
  },
  // ── 2 office days — WFH on this mock day ──────────────────────────────────────
  {
    // Darren clock-out GPS from SPEC (~8km from office)
    employee_code: 'Daza01', employee_name: 'Zahra Darren',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    time_in: '09:00', time_out: '17:30', hours_worked: 8.25,
    location_in_name: 'Home', location_in_lat: 35.84552877, location_in_lng: 14.52029529,
    location_out_name: 'Home', location_out_lat: 35.84552877, location_out_lng: 14.52029529,
    clocking_status: 'Active Clocking',
  },
  {
    employee_code: 'Alza01', employee_name: 'Zanussi Alec',
    job_schedule: 'Full Time 40Hrs', unit: 'Content', business_unit: 'Content',
    time_in: '08:30', time_out: '17:30', hours_worked: 8.75,
    location_in_name: 'Home', location_in_lat: 35.91, location_in_lng: 14.52,
    location_out_name: 'Home', location_out_lat: 35.91, location_out_lng: 14.52,
    clocking_status: 'Active Clocking',
  },
  // ── 1 office day — WFH on this mock day ───────────────────────────────────────
  {
    employee_code: 'Chde01', employee_name: 'Deeken Christian',
    job_schedule: 'Full Time 40Hrs', unit: 'Management', business_unit: 'Operations',
    time_in: '09:00', time_out: '18:00', hours_worked: 8.5,
    location_in_name: 'Home', location_in_lat: 35.87, location_in_lng: 14.51,
    location_out_name: 'Home', location_out_lat: 35.87, location_out_lng: 14.51,
    clocking_status: 'Active Clocking',
  },
]

function getMockClockings(date: string): TalexioClocking[] {
  const day_of_week = getDayOfWeek(date)
  return MOCK_EMPLOYEES.map(emp => ({ ...emp, date, day_of_week }))
}

// ─── Retry ──────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3
// Delays before attempt 2 and 3 only — the third value (2000) is intentionally
// unused because the last attempt always throws rather than delaying.
const RETRY_DELAYS_MS = [500, 1000, 2000] as const

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response

    try {
      response = await fetch(url, options)
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        throw new TalexioApiError(
          `Talexio API unreachable after ${MAX_ATTEMPTS} attempts`,
          undefined,
          err,
        )
      }
      await delay(RETRY_DELAYS_MS[attempt - 1])
      continue
    }

    // 4xx — configuration or auth error, do not retry
    if (response.status >= 400 && response.status < 500) {
      throw new TalexioApiError(
        `Talexio API error ${response.status}: ${response.statusText}`,
        response.status,
      )
    }

    if (response.ok) return response

    // 5xx — transient server error, retry
    if (attempt === MAX_ATTEMPTS) {
      throw new TalexioApiError(
        `Talexio API error ${response.status} after ${MAX_ATTEMPTS} attempts: ${response.statusText}`,
        response.status,
      )
    }
    await delay(RETRY_DELAYS_MS[attempt - 1])
  }

  // Unreachable — loop always returns or throws within MAX_ATTEMPTS
  throw new TalexioApiError('Unexpected retry loop exit')
}

// ─── Main export ─────────────────────────────────────────────────────────────────

export async function fetchClockings(date: string): Promise<TalexioClocking[]> {
  if (!process.env.TALEXIO_API_URL) {
    return getMockClockings(date)
  }

  if (!process.env.TALEXIO_API_KEY) {
    throw new TalexioApiError(
      'TALEXIO_API_KEY is required when TALEXIO_API_URL is set',
    )
  }

  const url = `${process.env.TALEXIO_API_URL}/api/clockings?date=${date}`
  const response = await fetchWithRetry(url, {
    headers: {
      Authorization: `Bearer ${process.env.TALEXIO_API_KEY}`,
      Accept: 'application/json',
    },
  })

  let json: unknown
  try {
    json = await response.json()
  } catch (err) {
    throw new TalexioApiError(
      'Talexio API returned a non-JSON response',
      response.status,
      err,
    )
  }
  const parsed = TalexioResponseSchema.safeParse(json)

  if (!parsed.success) {
    throw new TalexioApiError(
      `Talexio API response failed Zod validation: ${parsed.error.message}`,
      undefined,
      parsed.error,
    )
  }

  return parsed.data
}
