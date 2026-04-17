# Talexio Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/lib/talexio/client.ts` — a typed `fetchClockings(date)` function with Zod response validation, exponential-backoff retry, and mock mode when `TALEXIO_API_URL` is unset.

**Architecture:** Thin functional module — one exported function, one error class, one schema. No class, no factory. Mock mode is a top-level env-var branch; live mode fetches from `{TALEXIO_API_URL}/api/clockings?date={date}` with a Bearer token. The retry helper is an internal function.

**Tech Stack:** TypeScript (strict), Zod v4, Node.js `fetch`, Vitest

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/lib/talexio/client.ts` | Zod schema, error class, mock data, retry, `fetchClockings` |
| Create | `src/lib/talexio/client.test.ts` | All unit tests |
| Create | `vitest.config.ts` | Minimal Vitest config (no existing config found) |

---

## Task 1: Vitest config + Zod schema + TalexioApiError

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/talexio/client.ts` (schema + error only)
- Create: `src/lib/talexio/client.test.ts` (schema tests only)

- [ ] **Step 1.1: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 1.2: Write failing schema tests**

```typescript
// src/lib/talexio/client.test.ts
import { describe, it, expect } from 'vitest'
import { TalexioResponseSchema, TalexioApiError } from './client'

describe('TalexioResponseSchema', () => {
  it('parses a fully-populated clocking record', () => {
    const raw = [
      {
        employee_code: 'Daza01',
        employee_name: 'Zahra Darren',
        date: '2026-04-06',
        day_of_week: 'Monday',
        clocking_status: 'Active Clocking',
        time_in: '08:55',
        time_out: '17:30',
        hours_worked: 8.58,
        location_in_name: 'Head Office',
        location_in_lat: 35.9222072,
        location_in_lng: 14.4878368,
        location_out_name: 'Head Office',
        location_out_lat: 35.9222072,
        location_out_lng: 14.4878368,
        job_schedule: 'Full Time 40Hrs',
        unit: 'VIP Team JS',
        business_unit: 'Sports',
      },
    ]
    const result = TalexioResponseSchema.safeParse(raw)
    expect(result.success).toBe(true)
  })

  it('accepts null optional fields — broken clocking with no GPS', () => {
    const raw = [
      {
        employee_code: 'Niwi01',
        employee_name: 'Niklas Wirth',
        date: '2026-04-06',
        day_of_week: 'Monday',
        clocking_status: 'Active Clocking',
        time_in: null,
        time_out: null,
        hours_worked: null,
        location_in_name: null,
        location_in_lat: null,
        location_in_lng: null,
        location_out_name: null,
        location_out_lat: null,
        location_out_lng: null,
        job_schedule: null,
        unit: null,
        business_unit: null,
      },
    ]
    const result = TalexioResponseSchema.safeParse(raw)
    expect(result.success).toBe(true)
  })

  it('accepts a record with only required fields present', () => {
    const raw = [
      {
        employee_code: 'Niwi01',
        employee_name: 'Niklas Wirth',
        date: '2026-04-06',
        day_of_week: 'Monday',
        clocking_status: 'Active Clocking',
      },
    ]
    const result = TalexioResponseSchema.safeParse(raw)
    expect(result.success).toBe(true)
  })

  it('rejects a record missing employee_code', () => {
    const raw = [
      {
        employee_name: 'Zahra Darren',
        date: '2026-04-06',
        day_of_week: 'Monday',
        clocking_status: 'Active Clocking',
      },
    ]
    const result = TalexioResponseSchema.safeParse(raw)
    expect(result.success).toBe(false)
  })

  it('rejects a record missing clocking_status', () => {
    const raw = [
      {
        employee_code: 'Daza01',
        employee_name: 'Zahra Darren',
        date: '2026-04-06',
        day_of_week: 'Monday',
      },
    ]
    const result = TalexioResponseSchema.safeParse(raw)
    expect(result.success).toBe(false)
  })

  it('parses an empty array (no clockings on a day)', () => {
    const result = TalexioResponseSchema.safeParse([])
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })
})

describe('TalexioApiError', () => {
  it('is an Error with name TalexioApiError', () => {
    const err = new TalexioApiError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('TalexioApiError')
    expect(err.message).toBe('test')
  })

  it('stores optional status code', () => {
    const err = new TalexioApiError('not found', 404)
    expect(err.status).toBe(404)
  })

  it('status is undefined when not provided', () => {
    const err = new TalexioApiError('network failure')
    expect(err.status).toBeUndefined()
  })
})
```

- [ ] **Step 1.3: Run tests — expect them to fail (module not found)**

```bash
cd wfh-sentinel && npx vitest run src/lib/talexio/client.test.ts
```

Expected: `Error: Cannot find module './client'`

- [ ] **Step 1.4: Implement schema and error class in client.ts**

```typescript
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
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TalexioApiError'
  }
}
```

- [ ] **Step 1.5: Run tests — expect all to pass**

```bash
npx vitest run src/lib/talexio/client.test.ts
```

Expected output:
```
✓ src/lib/talexio/client.test.ts (9)
  ✓ TalexioResponseSchema (6)
  ✓ TalexioApiError (3)
Test Files  1 passed (1)
Tests       9 passed (9)
```

- [ ] **Step 1.6: Commit**

```bash
git add vitest.config.ts src/lib/talexio/client.ts src/lib/talexio/client.test.ts
git commit -m "feat(talexio): add Zod schema and TalexioApiError"
```

---

## Task 2: Mock data and getMockClockings

All 14 SPEC employees (Olivier is excluded — no `talexio_id`). Three built-in edge cases that the compliance engine must handle: Niklas (no clocking), Tina (broken clocking), Redvers (wrong GPS location).

**Files:**
- Modify: `src/lib/talexio/client.ts` (add mock data + `getMockClockings`)
- Modify: `src/lib/talexio/client.test.ts` (add mock mode tests)

- [ ] **Step 2.1: Add mock mode tests**

Append to `src/lib/talexio/client.test.ts`:

```typescript
import { fetchClockings } from './client'

describe('fetchClockings — mock mode (TALEXIO_API_URL not set)', () => {
  const savedUrl = process.env.TALEXIO_API_URL

  beforeEach(() => {
    delete process.env.TALEXIO_API_URL
  })

  afterEach(() => {
    if (savedUrl !== undefined) process.env.TALEXIO_API_URL = savedUrl
    else delete process.env.TALEXIO_API_URL
  })

  it('returns 14 records — one per SPEC employee with a talexio_id', async () => {
    const result = await fetchClockings('2026-04-06')
    expect(result).toHaveLength(14)
  })

  it('sets date to the requested date on every record', async () => {
    const result = await fetchClockings('2026-04-06')
    expect(result.every(r => r.date === '2026-04-06')).toBe(true)
  })

  it('computes day_of_week Monday for 2026-04-06', async () => {
    const result = await fetchClockings('2026-04-06')
    expect(result.every(r => r.day_of_week === 'Monday')).toBe(true)
  })

  it('computes day_of_week Wednesday for 2026-04-08', async () => {
    const result = await fetchClockings('2026-04-08')
    expect(result.every(r => r.day_of_week === 'Wednesday')).toBe(true)
  })

  it('computes day_of_week Friday for 2026-04-10', async () => {
    const result = await fetchClockings('2026-04-10')
    expect(result.every(r => r.day_of_week === 'Friday')).toBe(true)
  })

  it('includes Niklas (Niwi01) with no clocking — null time_in and time_out', async () => {
    const result = await fetchClockings('2026-04-06')
    const niklas = result.find(r => r.employee_code === 'Niwi01')
    expect(niklas).toBeDefined()
    expect(niklas!.time_in).toBeNull()
    expect(niklas!.time_out).toBeNull()
    expect(niklas!.location_in_lat).toBeNull()
  })

  it('includes Tina (Tiko01) as broken clocking — time_in set, time_out null', async () => {
    const result = await fetchClockings('2026-04-06')
    const tina = result.find(r => r.employee_code === 'Tiko01')
    expect(tina).toBeDefined()
    expect(tina!.clocking_status).toBe('Broken clocking')
    expect(tina!.time_in).toBeTruthy()
    expect(tina!.time_out).toBeNull()
  })

  it('includes Redvers (Rewh01) with wrong-location GPS (~3.8km from office)', async () => {
    const result = await fetchClockings('2026-04-06')
    const redvers = result.find(r => r.employee_code === 'Rewh01')
    expect(redvers).toBeDefined()
    expect(redvers!.location_in_lat).toBe(35.88758842)
    expect(redvers!.location_in_lng).toBe(14.48299381)
  })

  it('all 14 mock records pass Zod validation', async () => {
    const result = await fetchClockings('2026-04-06')
    const parsed = TalexioResponseSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })
})
```

- [ ] **Step 2.2: Run — expect 9 new failures (getMockClockings not yet implemented)**

```bash
npx vitest run src/lib/talexio/client.test.ts
```

Expected: 9 tests fail with `fetchClockings is not a function` or similar.

- [ ] **Step 2.3: Implement mock data and getMockClockings in client.ts**

Append after `TalexioApiError` in `src/lib/talexio/client.ts`:

```typescript
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
    // No clocking — per SPEC, Niklas frequently has "No clocking" in Daily Reports
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
    // Broken clocking edge case — per SPEC: time_in present, time_out null, wrong GPS
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
```

- [ ] **Step 2.4: Add stub for fetchClockings so tests can import it**

Append to `src/lib/talexio/client.ts`:

```typescript
// ─── Main export (stub — full implementation in Task 3) ──────────────────────

export async function fetchClockings(date: string): Promise<TalexioClocking[]> {
  if (!process.env.TALEXIO_API_URL) {
    return getMockClockings(date)
  }
  throw new TalexioApiError('Live mode not yet implemented')
}
```

- [ ] **Step 2.5: Run tests — expect all 18 tests to pass**

```bash
npx vitest run src/lib/talexio/client.test.ts
```

Expected output:
```
✓ src/lib/talexio/client.test.ts (18)
Test Files  1 passed (1)
Tests       18 passed (18)
```

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/talexio/client.ts src/lib/talexio/client.test.ts
git commit -m "feat(talexio): add mock data and getMockClockings"
```

---

## Task 3: fetchWithRetry + complete fetchClockings

**Files:**
- Modify: `src/lib/talexio/client.ts` (replace stub with full implementation)
- Modify: `src/lib/talexio/client.test.ts` (add live mode + retry tests)

- [ ] **Step 3.1: Add live mode and retry tests**

Append to `src/lib/talexio/client.test.ts`:

```typescript
describe('fetchClockings — live mode', () => {
  beforeEach(() => {
    vi.stubEnv('TALEXIO_API_URL', 'https://api.example.com')
    vi.stubEnv('TALEXIO_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('throws TalexioApiError immediately if TALEXIO_API_KEY is missing', async () => {
    vi.stubEnv('TALEXIO_API_KEY', '')
    await expect(fetchClockings('2026-04-06')).rejects.toThrow(TalexioApiError)
    await expect(fetchClockings('2026-04-06')).rejects.toThrow('TALEXIO_API_KEY')
  })

  it('calls the correct URL with Bearer auth header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchClockings('2026-04-06')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/api/clockings?date=2026-04-06',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    )
  })

  it('returns validated records on a successful 200 response', async () => {
    const rawRecords = [
      {
        employee_code: 'Owor01',
        employee_name: 'Ordway Owen',
        date: '2026-04-06',
        day_of_week: 'Monday',
        clocking_status: 'Active Clocking',
        time_in: '08:55',
        time_out: '18:05',
        hours_worked: 8.75,
        location_in_name: 'Head Office',
        location_in_lat: 35.9222072,
        location_in_lng: 14.4878368,
        location_out_name: 'Head Office',
        location_out_lat: 35.9222072,
        location_out_lng: 14.4878368,
        job_schedule: 'Full Time 40Hrs',
        unit: 'VIP Team JS',
        business_unit: 'Sports',
      },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(rawRecords),
    }))

    const result = await fetchClockings('2026-04-06')
    expect(result).toHaveLength(1)
    expect(result[0].employee_code).toBe('Owor01')
  })

  it('throws TalexioApiError when response fails Zod validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([{ invalid_field: 'unexpected shape' }]),
    }))

    await expect(fetchClockings('2026-04-06')).rejects.toThrow(TalexioApiError)
  })
})

describe('fetchClockings — retry behavior', () => {
  beforeEach(() => {
    vi.stubEnv('TALEXIO_API_URL', 'https://api.example.com')
    vi.stubEnv('TALEXIO_API_KEY', 'test-key')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('retries on 500 and succeeds on the third attempt', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue([]) })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws TalexioApiError after 3 failed 500 responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, statusText: 'Server Error',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow(TalexioApiError)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws TalexioApiError after 3 network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow(TalexioApiError)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('does NOT retry on 401 — fails immediately after 1 attempt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, statusText: 'Unauthorized',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow(TalexioApiError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 403 — fails immediately after 1 attempt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 403, statusText: 'Forbidden',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow(TalexioApiError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 404 — fails immediately after 1 attempt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 404, statusText: 'Not Found',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow(TalexioApiError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('the TalexioApiError from a 4xx includes the status code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, statusText: 'Unauthorized',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toMatchObject({ status: 401 })
  })
})
```

- [ ] **Step 3.2: Run — expect 13 new failures**

```bash
npx vitest run src/lib/talexio/client.test.ts
```

Expected: 13 tests fail (live mode and retry tests cannot pass with the stub).

- [ ] **Step 3.3: Replace the fetchClockings stub with the full implementation**

Replace the stub block (from `// ─── Main export` to end of file) in `src/lib/talexio/client.ts` with:

```typescript
// ─── Retry ──────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3
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
      'Content-Type': 'application/json',
    },
  })

  const json: unknown = await response.json()
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
```

- [ ] **Step 3.4: Run all tests — expect all 31 to pass**

```bash
npx vitest run src/lib/talexio/client.test.ts
```

Expected output:
```
✓ src/lib/talexio/client.test.ts (31)
  ✓ TalexioResponseSchema (6)
  ✓ TalexioApiError (3)
  ✓ fetchClockings — mock mode (9)
  ✓ fetchClockings — live mode (4)
  ✓ fetchClockings — retry behavior (7)
Test Files  1 passed (1)
Tests       31 passed (31)
```

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/talexio/client.ts src/lib/talexio/client.test.ts
git commit -m "feat(talexio): implement fetchClockings with retry and mock mode"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `fetchClockings(date)` exported and typed — Task 3
- [x] Zod response validation — Task 1 (schema) + Task 3 (safeParse in live path)
- [x] Retry logic — Task 3 (fetchWithRetry, 3 attempts, 500/1000/2000ms backoff)
- [x] Mock mode when `TALEXIO_API_URL` not set — Task 2
- [x] Mock uses real data structure from SPEC.md — Task 2 (14 employees, real GPS coords)
- [x] Three SPEC edge cases in mock: Niklas (no clocking), Tina (broken), Redvers (wrong GPS)
- [x] `TalexioApiError` exported for `sync.ts` to catch — Task 1
- [x] No retry on 4xx, retry on 5xx and network errors — Task 3

**Placeholder scan:** None found.

**Type consistency:**
- `TalexioClocking` defined in Task 1, used as return type throughout — consistent.
- `TalexioResponseSchema` defined in Task 1, used in Task 3 `safeParse` — consistent.
- `MockEmployee = Omit<TalexioClocking, 'date' | 'day_of_week'>` — consistent with spread in `getMockClockings`.
