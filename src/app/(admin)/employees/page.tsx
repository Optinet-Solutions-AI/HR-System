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
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Employee Configuration</h1>
        <p className="text-destructive">Failed to load employees: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Employee Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage employee settings, roles, and WFH allocations
        </p>
      </div>
      <EmployeesTable employees={employees ?? []} />
    </div>
  )
}
