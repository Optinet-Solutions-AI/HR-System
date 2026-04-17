// src/lib/mock/client.ts
// Mock Supabase client for demo mode.
// Supports the chainable query builder API used throughout the app.

import { getTableData, DEMO_USER_ID, DEMO_USER_EMAIL } from './data'

// ─── MockQueryBuilder ───────────────────────────────────────────────────────────
// Mimics Supabase's PostgREST query builder. Collects filters/ordering, then
// resolves against in-memory data when awaited (via PromiseLike).

type FilterFn = (row: Record<string, unknown>) => boolean

class MockQueryBuilder {
  private _data: Record<string, unknown>[]
  private _filters: FilterFn[] = []
  private _orderColumn: string | null = null
  private _orderAscending = true
  private _isSingle = false
  private _isMaybeSingle = false
  private _limitCount: number | null = null
  private _isWrite = false
  private _writePayload: unknown = null
  private _selectCalled = false

  constructor(data: unknown[]) {
    this._data = data as Record<string, unknown>[]
  }

  // ── Select ──────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(_columns?: string): this {
    this._selectCalled = true
    // We ignore column filtering — always return full rows.
    // The consuming code only reads the fields it needs.
    return this
  }

  // ── Filters ─────────────────────────────────────────────────────────────────

  eq(column: string, value: unknown): this {
    this._filters.push((row) => row[column] === value)
    return this
  }

  neq(column: string, value: unknown): this {
    this._filters.push((row) => row[column] !== value)
    return this
  }

  gte(column: string, value: unknown): this {
    this._filters.push((row) => {
      const v = row[column]
      if (v == null) return false
      return String(v) >= String(value)
    })
    return this
  }

  lte(column: string, value: unknown): this {
    this._filters.push((row) => {
      const v = row[column]
      if (v == null) return false
      return String(v) <= String(value)
    })
    return this
  }

  gt(column: string, value: unknown): this {
    this._filters.push((row) => {
      const v = row[column]
      if (v == null) return false
      return String(v) > String(value)
    })
    return this
  }

  lt(column: string, value: unknown): this {
    this._filters.push((row) => {
      const v = row[column]
      if (v == null) return false
      return String(v) < String(value)
    })
    return this
  }

  in(column: string, values: unknown[]): this {
    const valSet = new Set(values)
    this._filters.push((row) => valSet.has(row[column]))
    return this
  }

  is(column: string, value: unknown): this {
    this._filters.push((row) => row[column] === value)
    return this
  }

  contains(column: string, value: unknown): this {
    this._filters.push((row) => {
      const v = row[column]
      if (Array.isArray(v) && Array.isArray(value)) {
        return value.every(item => v.includes(item))
      }
      return false
    })
    return this
  }

  filter(column: string, operator: string, value: unknown): this {
    switch (operator) {
      case 'eq': return this.eq(column, value)
      case 'neq': return this.neq(column, value)
      case 'gte': return this.gte(column, value)
      case 'lte': return this.lte(column, value)
      case 'gt': return this.gt(column, value)
      case 'lt': return this.lt(column, value)
      default: return this
    }
  }

  // ── Ordering ────────────────────────────────────────────────────────────────

  order(column: string, options?: { ascending?: boolean }): this {
    this._orderColumn = column
    this._orderAscending = options?.ascending ?? true
    return this
  }

  // ── Limit ───────────────────────────────────────────────────────────────────

  limit(count: number): this {
    this._limitCount = count
    return this
  }

  // ── Terminal: single / maybeSingle ──────────────────────────────────────────

  single(): PromiseLike<{ data: Record<string, unknown> | null; error: { code: string; message: string } | null }> {
    this._isSingle = true
    return this as unknown as PromiseLike<{ data: Record<string, unknown> | null; error: { code: string; message: string } | null }>
  }

  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: null }> {
    this._isMaybeSingle = true
    return this as unknown as PromiseLike<{ data: Record<string, unknown> | null; error: null }>
  }

  // ── Write operations (no-ops in demo mode) ─────────────────────────────────

  insert(data: unknown): MockQueryBuilder {
    this._isWrite = true
    this._writePayload = Array.isArray(data) ? data : [data]
    return this
  }

  upsert(data: unknown): MockQueryBuilder {
    this._isWrite = true
    this._writePayload = Array.isArray(data) ? data : [data]
    return this
  }

  update(data: unknown): MockQueryBuilder {
    this._isWrite = true
    this._writePayload = data
    return this
  }

  delete(): MockQueryBuilder {
    this._isWrite = true
    return this
  }

  // ── Execute / PromiseLike ─────────────────────────────────────────────────

  private _execute(): { data: unknown; error: unknown } {
    // Write operations → return the payload back
    if (this._isWrite) {
      if (this._selectCalled && this._isSingle && this._writePayload) {
        const payload = Array.isArray(this._writePayload) ? this._writePayload[0] : this._writePayload
        return { data: payload, error: null }
      }
      if (this._selectCalled && this._writePayload) {
        return { data: this._writePayload, error: null }
      }
      return { data: null, error: null }
    }

    // Read operations → filter, sort, return
    let results = [...this._data]

    for (const filter of this._filters) {
      results = results.filter(filter)
    }

    if (this._orderColumn) {
      const col = this._orderColumn
      const asc = this._orderAscending
      results.sort((a, b) => {
        const va = a[col]
        const vb = b[col]
        if (va == null && vb == null) return 0
        if (va == null) return asc ? -1 : 1
        if (vb == null) return asc ? 1 : -1
        const cmp = String(va).localeCompare(String(vb))
        return asc ? cmp : -cmp
      })
    }

    if (this._limitCount !== null) {
      results = results.slice(0, this._limitCount)
    }

    if (this._isSingle) {
      if (results.length === 0) {
        return { data: null, error: { code: 'PGRST116', message: 'Row not found' } }
      }
      return { data: results[0], error: null }
    }

    if (this._isMaybeSingle) {
      return { data: results[0] ?? null, error: null }
    }

    return { data: results, error: null }
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this._execute()
      return Promise.resolve(onfulfilled ? onfulfilled(result) : result as unknown as TResult1)
    } catch (err) {
      if (onrejected) return Promise.resolve(onrejected(err))
      return Promise.reject(err)
    }
  }
}

// ─── Mock Auth ──────────────────────────────────────────────────────────────────

const mockAuth = {
  getUser: async () => ({
    data: {
      user: {
        id: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    },
    error: null,
  }),
  getSession: async () => ({
    data: {
      session: {
        access_token: 'demo-token',
        refresh_token: 'demo-refresh',
        user: {
          id: DEMO_USER_ID,
          email: DEMO_USER_EMAIL,
        },
      },
    },
    error: null,
  }),
  signInWithPassword: async () => ({
    data: {
      user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL },
      session: { access_token: 'demo-token', refresh_token: 'demo-refresh' },
    },
    error: null,
  }),
  signOut: async () => ({ error: null }),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAuthStateChange: (_event: string, _callback: unknown) => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
}

// ─── Mock Realtime Channel ──────────────────────────────────────────────────────

function createMockChannel() {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => {},
  }
  return channel
}

// ─── Mock Supabase Client ───────────────────────────────────────────────────────

export function createMockSupabaseClient() {
  return {
    from: (table: string) => new MockQueryBuilder(getTableData(table) as Record<string, unknown>[]),
    auth: mockAuth,
    channel: () => createMockChannel(),
    removeChannel: () => {},
    rpc: async () => ({ data: null, error: null }),
  }
}
