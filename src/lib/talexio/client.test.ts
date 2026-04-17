// src/lib/talexio/client.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TalexioResponseSchema, TalexioApiError, fetchClockings } from './client'

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

  it('stores optional cause on Error.cause', () => {
    const root = new Error('network timeout')
    const err = new TalexioApiError('fetch failed', 503, root)
    expect(err.cause).toBe(root)
  })
})

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

  it('throws TalexioApiError when response body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
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

  it('retries on network error and succeeds on the second attempt', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue([]) })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(2)
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
    await Promise.all([
      expect(promise).rejects.toThrow(TalexioApiError),
      vi.runAllTimersAsync(),
    ])
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws TalexioApiError after 3 network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await Promise.all([
      expect(promise).rejects.toThrow(TalexioApiError),
      vi.runAllTimersAsync(),
    ])
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('does NOT retry on 401 — fails immediately after 1 attempt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, statusText: 'Unauthorized',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await Promise.all([
      expect(promise).rejects.toThrow(TalexioApiError),
      vi.runAllTimersAsync(),
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 403 — fails immediately after 1 attempt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 403, statusText: 'Forbidden',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await Promise.all([
      expect(promise).rejects.toThrow(TalexioApiError),
      vi.runAllTimersAsync(),
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 404 — fails immediately after 1 attempt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 404, statusText: 'Not Found',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await Promise.all([
      expect(promise).rejects.toThrow(TalexioApiError),
      vi.runAllTimersAsync(),
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('the TalexioApiError from a 4xx includes the status code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, statusText: 'Unauthorized',
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchClockings('2026-04-06')
    await Promise.all([
      expect(promise).rejects.toMatchObject({ status: 401 }),
      vi.runAllTimersAsync(),
    ])
  })
})
