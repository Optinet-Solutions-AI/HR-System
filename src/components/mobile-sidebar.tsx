'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { SidebarContent, type NavItem } from '@/components/sidebar'
import type { UserRole } from '@/lib/types/app'

type MobileSidebarProps = {
  navItems: NavItem[]
  employeeName: string
  role: UserRole
}

export function MobileSidebar({ navItems, employeeName, role }: MobileSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent navItems={navItems} employeeName={employeeName} role={role} />
      </SheetContent>
    </Sheet>
  )
}
