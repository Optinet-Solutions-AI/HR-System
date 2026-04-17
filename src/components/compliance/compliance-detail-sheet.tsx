'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  STATUS_COLORS,
  ACTUAL_STATUS_COLOR_MAP,
  ACTUAL_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
  COMPLIANCE_FLAG_LABELS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ComplianceOverrideForm } from './compliance-override-form'
import type { ComplianceRecord } from '@/lib/types/app'

interface ComplianceDetailSheetProps {
  record: ComplianceRecord | null
  employeeName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onOverrideSuccess: () => void
}

function BoolIcon({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">N/A</span>
  return value ? (
    <Check className="h-4 w-4 text-green-600" />
  ) : (
    <X className="h-4 w-4 text-red-500" />
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-b-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm text-right">{children}</div>
    </div>
  )
}

export function ComplianceDetailSheet({
  record,
  employeeName,
  open,
  onOpenChange,
  onOverrideSuccess,
}: ComplianceDetailSheetProps) {
  const [showOverrideForm, setShowOverrideForm] = useState(false)

  // Reset override form when switching between records
  useEffect(() => {
    setShowOverrideForm(false)
  }, [record?.id])

  if (!record) return null

  const actualColorKey = ACTUAL_STATUS_COLOR_MAP[record.actual_status] ?? 'unknown'
  const actualColors = STATUS_COLORS[actualColorKey]

  const expectedColors = record.expected_status
    ? (STATUS_COLORS[record.expected_status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.unknown)
    : null

  const flags = record.flags ?? []

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setShowOverrideForm(false)
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {employeeName} &mdash; {format(parseISO(record.date), 'EEE d MMM yyyy')}
          </SheetTitle>
          <SheetDescription>
            Compliance details for {format(parseISO(record.date), 'EEEE')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-1">
          <DetailRow label="Expected">
            {record.expected_status && expectedColors ? (
              <Badge className={cn(expectedColors.bg, expectedColors.text, 'border-0')}>
                {SCHEDULE_STATUS_LABELS[record.expected_status] ?? record.expected_status}
              </Badge>
            ) : (
              <span className="text-muted-foreground">&mdash;</span>
            )}
          </DetailRow>

          <DetailRow label="Actual">
            <Badge className={cn(actualColors.bg, actualColors.text, 'border-0')}>
              {ACTUAL_STATUS_LABELS[record.actual_status] ?? record.actual_status}
            </Badge>
          </DetailRow>

          <DetailRow label="Compliant">
            <div className="flex items-center gap-1.5">
              <BoolIcon value={record.is_compliant} />
              <span>{record.is_compliant ? 'Yes' : 'No'}</span>
            </div>
          </DetailRow>

          <DetailRow label="Has Clocking">
            <BoolIcon value={record.has_clocking} />
          </DetailRow>

          <DetailRow label="Has Booking">
            <BoolIcon value={record.has_booking} />
          </DetailRow>

          <DetailRow label="Location Match">
            <BoolIcon value={record.location_match} />
          </DetailRow>

          <DetailRow label="Flags">
            {flags.length > 0 ? (
              <div className="flex flex-wrap gap-1 justify-end">
                {flags.map((flag) => (
                  <Badge key={flag} variant="destructive" className="text-xs">
                    {COMPLIANCE_FLAG_LABELS[flag] ?? flag}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </DetailRow>

          <DetailRow label="Comment">
            <span>{record.comment || '\u2014'}</span>
          </DetailRow>

          <DetailRow label="Override Reason">
            <span>{record.override_reason || '\u2014'}</span>
          </DetailRow>

          <DetailRow label="Reviewed At">
            <span>
              {record.reviewed_at
                ? format(parseISO(record.reviewed_at), 'dd MMM yyyy HH:mm')
                : '\u2014'}
            </span>
          </DetailRow>
        </div>

        {/* Override section */}
        <div className="border-t p-4">
          {record.is_compliant && record.override_reason ? (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Check className="h-4 w-4" />
              <span>Overridden as compliant</span>
            </div>
          ) : !record.is_compliant ? (
            showOverrideForm ? (
              <ComplianceOverrideForm
                recordId={record.id}
                onSuccess={() => {
                  setShowOverrideForm(false)
                  onOverrideSuccess()
                }}
                onCancel={() => setShowOverrideForm(false)}
              />
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowOverrideForm(true)}
              >
                Override as Compliant
              </Button>
            )
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
