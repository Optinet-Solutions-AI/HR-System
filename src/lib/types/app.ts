// App-specific types, enums, and constants
// Database types come from database.ts (auto-generated)
// This file contains types derived from or extending the database types

import type { Database } from './database'

// Table row types (convenience aliases)
export type Employee = Database['public']['Tables']['employees']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Schedule = Database['public']['Tables']['schedules']['Row']
export type Clocking = Database['public']['Tables']['clockings']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type ComplianceRecord = Database['public']['Tables']['compliance_records']['Row']
export type ScheduleRule = Database['public']['Tables']['schedule_rules']['Row']
export type OfficeLocation = Database['public']['Tables']['office_locations']['Row']
export type PublicHoliday = Database['public']['Tables']['public_holidays']['Row']

// Enum types
export type UserRole = Database['public']['Enums']['user_role']
export type ScheduleStatus = Database['public']['Enums']['schedule_status']
export type ActualStatus = Database['public']['Enums']['actual_status']
export type ComplianceFlag = Database['public']['Enums']['compliance_flag']

// Admin calendar grid row (pivoted: one row per employee, dates as columns)
export type CalendarRow = {
  employeeId: string
  employeeName: string
  officeDaysPerWeek: number
  dates: Record<string, ScheduleStatus>
}

// Compliance weekly grid row (pivoted: one row per employee, dates as columns)
export type ComplianceWeekRow = {
  employeeId: string
  employeeName: string
  dates: Record<string, ComplianceRecord | null>
}

// API response types
export type ApiResponse<T> = {
  data: T
}

export type ApiError = {
  error: string
  message?: string
}

export type PaginatedResponse<T> = {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Reports types
export const REPORT_TABS = ['attendance', 'wfh', 'monday-friday'] as const
export type ReportTab = typeof REPORT_TABS[number]

// Dashboard types
export type DashboardStatusCounts = {
  inOffice: number
  wfh: number
  notClocked: number
  onLeave: number
  flagged: number
}

export type DashboardEmployeeRow = {
  employeeId: string
  firstName: string
  lastName: string
  expectedStatus: ScheduleStatus | null
  actualStatus: ActualStatus | null
  timeIn: string | null
  timeOut: string | null
  flags: ComplianceFlag[]
  isCompliant: boolean | null
}

export type DashboardData = {
  counts: DashboardStatusCounts
  employees: DashboardEmployeeRow[]
  todayDate: string
}
