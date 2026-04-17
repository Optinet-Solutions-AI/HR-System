import { redirect } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Sidebar, type NavItem } from '@/components/sidebar'
import { MobileSidebar } from '@/components/mobile-sidebar'

const NAV_ITEMS: NavItem[] = [
  { label: 'Calendar', href: '/calendar', icon: <Calendar className="h-4 w-4" /> },
]

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: employee, error } = await supabase
    .from('employees')
    .select('first_name, last_name, role')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !employee) redirect('/')

  const employeeName = `${employee.first_name} ${employee.last_name}`

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar navItems={NAV_ITEMS} employeeName={employeeName} role={employee.role} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b px-4 md:px-6">
          <MobileSidebar navItems={NAV_ITEMS} employeeName={employeeName} role={employee.role} />
          <h1 className="text-sm font-semibold">
            {employeeName}
            <span className="ml-2 text-xs font-normal text-muted-foreground">Employee</span>
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
