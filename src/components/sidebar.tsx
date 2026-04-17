import Link from 'next/link'
import { NavLink } from '@/components/nav-link'
import { UserProfileDropdown } from '@/components/user-profile-dropdown'
import { ThemeToggle } from '@/components/theme-toggle'
import type { UserRole } from '@/lib/types/app'

export type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
}

type SidebarProps = {
  navItems: NavItem[]
  employeeName: string
  role: UserRole
}

const ROLE_LABELS: Record<UserRole, string> = {
  employee: 'Employee',
  manager: 'Manager',
  hr_admin: 'HR Admin',
  super_admin: 'Super Admin',
}

export function Sidebar({ navItems, employeeName, role }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-primary-foreground"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">WFH Sentinel</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink key={item.href} href={item.href}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User Profile & Theme Toggle */}
      <div className="flex items-center gap-2 border-t p-3">
        <div className="flex-1 min-w-0">
          <UserProfileDropdown employeeName={employeeName} roleLabel={ROLE_LABELS[role]} />
        </div>
        <ThemeToggle />
      </div>
    </aside>
  )
}

export function SidebarContent({ navItems, employeeName, role }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink key={item.href} href={item.href}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User Profile & Theme Toggle */}
      <div className="flex items-center gap-2 border-t p-3">
        <div className="flex-1 min-w-0">
          <UserProfileDropdown employeeName={employeeName} roleLabel={ROLE_LABELS[role]} />
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}
