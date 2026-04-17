import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Clocking } from '@/lib/types/app'

type CacheEntry = { data: Clocking[]; fetchedAt: number }

export function useEmployeeClockings(
  employeeId: string,
  from: string,
  to: string,
  enabled: boolean,
) {
  const [data, setData] = useState<Clocking[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())

  const cacheKey = `${employeeId}:${from}:${to}`

  const fetchClockings = useCallback(async () => {
    // Check cache first
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setData(cached.data)
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createBrowserSupabaseClient()
    const { data: clockings, error: fetchError } = await supabase
      .from('clockings')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to)
      .order('date')

    if (fetchError) {
      setError(fetchError.message)
      setIsLoading(false)
      return
    }

    const result = (clockings ?? []) as Clocking[]
    cacheRef.current.set(cacheKey, { data: result, fetchedAt: Date.now() })
    setData(result)
    setIsLoading(false)
  }, [employeeId, from, to, cacheKey])

  useEffect(() => {
    if (!enabled) return
    fetchClockings()
  }, [enabled, fetchClockings])

  return { data, isLoading, error }
}
