'use client'

import { useState } from 'react'
import { Shield, CalendarHeart, ChevronRight } from 'lucide-react'
import { RulesPanel } from './rules-panel'
import { HolidaysPanel } from '@/components/holidays/holidays-panel'
import type { ScheduleRule, PublicHoliday } from '@/lib/types/app'

type RulesTab = 'rules' | 'holidays'

type TeamOption = { id: string; name: string }

const TAB_CONFIG = [
  {
    value: 'rules' as RulesTab,
    label: 'Schedule Rules',
    description: 'WFH limits & office attendance requirements',
    icon: Shield,
    accent: 'indigo',
  },
  {
    value: 'holidays' as RulesTab,
    label: 'Public Holidays',
    description: 'Manage recognised non-working days',
    icon: CalendarHeart,
    accent: 'rose',
  },
] as const

const ACCENT_STYLES = {
  indigo: {
    activeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    activeBorder: 'border-indigo-500',
    activeIcon: 'text-indigo-600 dark:text-indigo-400',
    activeText: 'text-indigo-900 dark:text-indigo-100',
    activeSub: 'text-indigo-600/80 dark:text-indigo-400/70',
    dot: 'bg-indigo-500',
  },
  rose: {
    activeBg: 'bg-rose-50 dark:bg-rose-950/40',
    activeBorder: 'border-rose-500',
    activeIcon: 'text-rose-600 dark:text-rose-400',
    activeText: 'text-rose-900 dark:text-rose-100',
    activeSub: 'text-rose-600/80 dark:text-rose-400/70',
    dot: 'bg-rose-500',
  },
} as const

interface RulesClientProps {
  rules: ScheduleRule[]
  holidays: PublicHoliday[]
  teams: TeamOption[]
}

export function RulesClient({ rules, holidays, teams }: RulesClientProps) {
  const [activeTab, setActiveTab] = useState<RulesTab>('rules')

  return (
    <div className="space-y-6">
      {/* Tab selector cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {TAB_CONFIG.map(t => {
          const isActive = activeTab === t.value
          const styles = ACCENT_STYLES[t.accent]
          const Icon = t.icon

          return (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`
                group relative flex items-start gap-3.5 rounded-xl border-2 p-4 text-left
                transition-all duration-200 ease-out
                ${isActive
                  ? `${styles.activeBg} ${styles.activeBorder} shadow-sm`
                  : 'border-transparent bg-muted/40 hover:bg-muted/70 hover:border-border/60'
                }
              `}
            >
              <div
                className={`
                  mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                  transition-colors duration-200
                  ${isActive
                    ? `${styles.activeBg} ${styles.activeIcon}`
                    : 'bg-muted text-muted-foreground group-hover:text-foreground/70'
                  }
                `}
              >
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                  )}
                  <span
                    className={`
                      text-sm font-semibold leading-tight
                      ${isActive ? styles.activeText : 'text-foreground/80 group-hover:text-foreground'}
                    `}
                  >
                    {t.label}
                  </span>
                </div>
                <p
                  className={`
                    mt-0.5 text-xs leading-snug
                    ${isActive ? styles.activeSub : 'text-muted-foreground'}
                  `}
                >
                  {t.description}
                </p>
              </div>
              <ChevronRight
                className={`
                  mt-1 h-4 w-4 shrink-0 transition-all duration-200
                  ${isActive
                    ? `${styles.activeIcon} translate-x-0 opacity-100`
                    : 'text-muted-foreground/0 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-40'
                  }
                `}
              />
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm sm:p-6">
        {activeTab === 'rules' && (
          <RulesPanel rules={rules} teams={teams} />
        )}
        {activeTab === 'holidays' && (
          <HolidaysPanel holidays={holidays} />
        )}
      </div>
    </div>
  )
}
