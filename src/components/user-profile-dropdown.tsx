'use client'

import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UserProfileDropdownProps = {
  employeeName: string
  roleLabel: string
}

export function UserProfileDropdown({ employeeName, roleLabel }: UserProfileDropdownProps) {
  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Failed to sign out')
      return
    }
    // Hard navigation clears all RSC cache and avoids race conditions
    // where the current layout re-renders with a dead session.
    window.location.href = '/login'
  }

  const initials = employeeName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'w-full justify-start gap-3 px-3 py-2 h-auto cursor-pointer'
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {initials}
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="text-sm font-medium leading-tight">{employeeName}</span>
          <span className="text-xs text-muted-foreground leading-tight">{roleLabel}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{employeeName}</span>
              <span className="text-xs font-normal text-muted-foreground">{roleLabel}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
