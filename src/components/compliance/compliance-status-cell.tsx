'use client'

import { STATUS_COLORS, ACTUAL_STATUS_COLOR_MAP, ACTUAL_STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ComplianceRecord, ActualStatus } from '@/lib/types/app'

const ACTUAL_STATUS_ABBREV: Record<ActualStatus, string> = {
  in_office_confirmed: 'O',
  wfh_confirmed: 'W',
  no_clocking: 'NC',
  wrong_location: 'WL',
  broken_clocking: 'BC',
  no_booking: 'NB',
  vacation: 'V',
  public_holiday: 'PH',
  unknown: '?',
}

interface ComplianceStatusCellProps {
  record: ComplianceRecord | null
  onClick?: () => void
}

export function ComplianceStatusCell({ record, onClick }: ComplianceStatusCellProps) {
  if (!record) {
    const colors = STATUS_COLORS.unknown
    return (
      <div
        className={cn(
          'flex h-8 w-full items-center justify-center rounded text-[11px] font-semibold',
          colors.bg,
          colors.text
        )}
      >
        --
      </div>
    )
  }

  const colorKey = ACTUAL_STATUS_COLOR_MAP[record.actual_status] ?? 'unknown'
  const colors = STATUS_COLORS[colorKey]
  const flags = record.flags ?? []
  const isOverridden = !!record.override_reason

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-8 w-full items-center justify-center rounded text-[11px] font-semibold transition-shadow hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        colors.bg,
        colors.text,
        isOverridden && 'ring-1 ring-blue-400'
      )}
      title={ACTUAL_STATUS_LABELS[record.actual_status] ?? record.actual_status}
    >
      {ACTUAL_STATUS_ABBREV[record.actual_status] ?? '?'}
      {flags.length > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
      )}
    </button>
  )
}
