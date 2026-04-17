# Design: Talexio API Client (`src/lib/talexio/client.ts`)

**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

A thin functional module that fetches daily clocking records from the Talexio REST API.
Exports one function: `fetchClockings(date)`. Includes Zod response validation, exponential-backoff retry, and a mock mode activated when `TALEXIO_API_URL` is not set.

---

## Architecture

**Pattern:** Thin functional module (no class, no factory).  
One exported function, one file. Consistent with the rest of `src/lib/`.

```
src/lib/talexio/client.ts
  └─ fetchClockings(date: string): Promise<TalexioClocking[]>
       ├─ mock mode  → returns MOCK_CLOCKINGS (when TALEXIO_API_URL unset)
       └─ live mode  → GET {TALEXIO_API_URL}/api/clockings?date={date}
                         └─ retry wrapper (up to 3 attempts)
                              └─ Zod parse → TalexioClocking[]
```

---

## Talexio API Contract (assumed — remap when real docs arrive)

```
GET {TALEXIO_API_URL}/api/clockings?date=YYYY-MM-DD
Authorization: Bearer {TALEXIO_API_KEY}
Content-Type: application/json

Response 200: TalexioClockingRaw[]   (JSON array)
Response 4xx: immediate failure (no retry)
Response 5xx: retry up to 3 times
```

---

## Zod Schema

```typescript
// Raw shape from Talexio — all fields except the three keys are optional
// because real-world data has broken clockings, no punch-out, no GPS, etc.
const TalexioClockingRawSchema = z.object({
  employee_code:      z.string(),          // "Daza01" — always present
  employee_name:      z.string(),          // "Zahra Darren"
  date:               z.string(),          // "2026-04-07"
  day_of_week:        z.string(),          // "Monday"
  time_in:            z.string().nullish(),
  time_out:           z.string().nullish(),
  hours_worked:       z.number().nullish(),
  location_in_name:   z.string().nullish(),
  location_in_lat:    z.number().nullish(),
  location_in_lng:    z.number().nullish(),
  location_out_name:  z.string().nullish(),
  location_out_lat:   z.number().nullish(),
  location_out_lng:   z.number().nullish(),
  clocking_status:    z.string(),          // "Active Clocking" | "Broken clocking"
  job_schedule:       z.string().nullish(),
  unit:               z.string().nullish(),
  business_unit:      z.string().nullish(),
})

// Array wrapper — response is a JSON array
const TalexioResponseSchema = z.array(TalexioClockingRawSchema)

// Exported type (inferred from schema)
export type TalexioClocking = z.infer<typeof TalexioClockingRawSchema>
```

---

## Retry Logic

- **Attempts:** 3
- **Strategy:** Exponential backoff — 500 ms, 1 000 ms, 2 000 ms
- **Retry on:** 5xx HTTP status codes, network errors (`fetch` throws)
- **No retry on:** 401, 403, 404, 400 — fail immediately with descriptive error
- **Last attempt fails:** throw `TalexioApiError` with status + message

```typescript
// Internal helper signature
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response>
```

---

## Mock Mode

Activated when `process.env.TALEXIO_API_URL` is falsy (local dev / CI without credentials).

Mock data uses real SPEC employee IDs and GPS coordinates:
- 14 employees with their actual `talexio_id` values
- Realistic mix: confirmed office, confirmed WFH, broken clocking, no punch-out
- Two edge cases always present: one employee with no GPS (Niklas-style), one with wrong-location GPS (Redvers-style)

```typescript
export async function fetchClockings(date: string): Promise<TalexioClocking[]> {
  if (!process.env.TALEXIO_API_URL) {
    // Returns all 14 SPEC employees for the requested date.
    // day_of_week is computed from `date` so callers always get a consistent record.
    return getMockClockings(date)
  }
  // ... live path
}
```

---

## Error Handling

- `TALEXIO_API_URL` set but `TALEXIO_API_KEY` missing → throw immediately (misconfiguration)
- Zod parse failure → throw `TalexioApiError` with the Zod error attached (unexpected API shape change)
- All errors include enough context to diagnose in logs — status code, URL, attempt count

---

## Testing Notes

Unit-testable without network: set `TALEXIO_API_URL` to `undefined` → mock path.  
Integration test: stub `fetch`, return a fixture array, assert Zod parse + retry count.  
Test file: `src/lib/talexio/client.test.ts`.

---

## What This File Does NOT Do

- Does not upsert to Supabase — that is `sync.ts`'s job
- Does not map `employee_code` → internal `employee_id` — that is `sync.ts`'s job
- Does not cache results — each call is a fresh fetch

---

## Environment Variables Used

| Variable | Required | Purpose |
|---|---|---|
| `TALEXIO_API_URL` | No (mock if absent) | Base URL for Talexio REST API |
| `TALEXIO_API_KEY` | If URL is set | Bearer token for auth |
