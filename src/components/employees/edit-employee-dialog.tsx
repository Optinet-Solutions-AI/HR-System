'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Employee, UserRole } from '@/lib/types/app'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]

interface EditEmployeeDialogProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditEmployeeDialog({
  employee,
  open,
  onOpenChange,
}: EditEmployeeDialogProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [officeDays, setOfficeDays] = useState(4)
  const [role, setRole] = useState<UserRole>('employee')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Reset form when employee changes
  useEffect(() => {
    if (employee) {
      setOfficeDays(employee.office_days_per_week)
      setRole(employee.role)
      setNotes(employee.notes ?? '')
      setIsActive(employee.is_active)
    }
  }, [employee])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return

    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          office_days_per_week: officeDays,
          role,
          notes: notes.trim() || null,
          is_active: isActive,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to update employee')
      }

      toast.success(`Updated ${employee.first_name} ${employee.last_name}`)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update employee')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit {employee?.first_name} {employee?.last_name}
          </DialogTitle>
          <DialogDescription>
            Update employee configuration
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Office Days per Week */}
            <div className="grid gap-2">
              <Label htmlFor="officeDays">Office Days per Week</Label>
              <Input
                id="officeDays"
                type="number"
                min={0}
                max={5}
                step={1}
                value={officeDays}
                onChange={(e) => setOfficeDays(parseInt(e.target.value, 10))}
              />
              <p className="text-xs text-muted-foreground">
                WFH days: {5 - officeDays} per week
              </p>
            </div>

            {/* Role */}
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-primary"
              />
              <Label htmlFor="isActive">Active Employee</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
