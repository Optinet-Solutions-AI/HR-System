'use client'

import { STATUS_COLORS, SCHEDULE_STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ScheduleStatus } from '@/lib/types/app'

const STATUS_ABBREV: Record<ScheduleStatus, string> = {
  office: 'O',
  wfh: 'W',
  public_holiday: 'PH',
  vacation: 'V',
  sick_leave: 'SL',
  not_scheduled: '--',
}

export function StatusCell({ status }: { status: ScheduleStatus }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.unknown

  return (
    <div
      className={cn(
        'flex h-7 w-full items-center justify-center rounded text-[10px] font-semibold',
        colors.bg,
        colors.text
      )}
      title={SCHEDULE_STATUS_LABELS[status] ?? status}
    >
      {STATUS_ABBREV[status] ?? '?'}
    </div>
  )
}
