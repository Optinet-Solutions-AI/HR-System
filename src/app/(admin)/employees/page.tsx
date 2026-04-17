import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EmployeesTable } from '@/components/employees/employees-table'

export default async function EmployeesPage() {
  const supabase = await createServerSupabaseClient()

  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .order('last_name', { ascending: true })

  if (error) {
    return (
      <div className="container mx-auto px-4 py-4 sm:p-6">
        <h1 className="text-xl font-bold mb-4 sm:text-2xl sm:mb-6">Employee Configuration</h1>
        <p className="text-destructive">Failed to load employees: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Employee Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage employee settings, roles, and WFH allocations
        </p>
      </div>
      <EmployeesTable employees={employees ?? []} />
    </div>
  )
}
