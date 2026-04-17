import { createServerSupabaseClient } from '@/lib/supabase/server'
import { RulesClient } from '@/components/rules/rules-client'

export default async function RulesPage() {
  const supabase = await createServerSupabaseClient()

  const [rulesResult, holidaysResult, teamsResult] = await Promise.all([
    supabase.from('schedule_rules').select('*').order('created_at', { ascending: true }),
    supabase.from('public_holidays').select('*').order('date', { ascending: true }),
    supabase.from('teams').select('id, name').order('name', { ascending: true }),
  ])

  const fetchError = rulesResult.error ?? holidaysResult.error
  if (fetchError) {
    return (
      <div className="container mx-auto px-4 py-4 sm:p-6">
        <h1 className="text-xl font-bold tracking-tight mb-4 sm:text-2xl sm:mb-6">Schedule Rules</h1>
        <p className="text-destructive">Failed to load data: {fetchError.message}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Schedule Rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage scheduling constraints and public holidays
        </p>
      </div>

      <RulesClient
        rules={rulesResult.data ?? []}
        holidays={holidaysResult.data ?? []}
        teams={teamsResult.data ?? []}
      />
    </div>
  )
}
