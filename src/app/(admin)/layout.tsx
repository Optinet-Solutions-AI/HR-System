import { redirect } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, ShieldCheck, Scale, FileBarChart } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Sidebar, type NavItem } from '@/components/sidebar'
import { MobileSidebar } from '@/components/mobile-sidebar'

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Employees', href: '/employees', icon: <Users className="h-4 w-4" /> },
  { label: 'Calendar', href: '/admin/calendar', icon: <Calendar className="h-4 w-4" /> },
  { label: 'Compliance', href: '/admin/compliance', icon: <ShieldCheck className="h-4 w-4" /> },
  { label: 'Rules', href: '/rules', icon: <Scale className="h-4 w-4" /> },
  { label: 'Reports', href: '/reports', icon: <FileBarChart className="h-4 w-4" /> },
]

export default async function AdminLayout({
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

  if (!['hr_admin', 'super_admin'].includes(employee.role)) redirect('/')

  const employeeName = `${employee.first_name} ${employee.last_name}`
  const roleLabel = employee.role === 'super_admin' ? 'Super Admin' : 'HR Admin'

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
            <span className="ml-2 text-xs font-normal text-muted-foreground">{roleLabel}</span>
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
