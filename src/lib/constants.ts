// ==========================================
// Color Coding — consistent across all UI
// ==========================================

export const STATUS_COLORS = {
  office: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  wfh: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  vacation: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
  },
  sick_leave: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  public_holiday: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
    dot: 'bg-gray-500',
  },
  violation: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  unknown: {
    bg: 'bg-gray-50',
    text: 'text-gray-400',
    border: 'border-gray-100',
    dot: 'bg-gray-300',
  },
  not_scheduled: {
    bg: 'bg-gray-50',
    text: 'text-gray-400',
    border: 'border-gray-100',
    dot: 'bg-gray-300',
  },
} as const

// ==========================================
// Office Location Defaults
// ==========================================

export const DEFAULT_OFFICE = {
  name: 'Head Office',
  latitude: 35.9222072,
  longitude: 14.4878368,
  radiusMeters: 200,
} as const

// ==========================================
// Schedule Status Labels
// ==========================================

export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  office: 'Office',
  wfh: 'Work From Home',
  public_holiday: 'Public Holiday',
  vacation: 'Vacation',
  sick_leave: 'Sick Leave',
  not_scheduled: 'Not Scheduled',
} as const

// ==========================================
// Actual Status Labels
// ==========================================

export const ACTUAL_STATUS_LABELS: Record<string, string> = {
  in_office_confirmed: 'In Office (Confirmed)',
  wfh_confirmed: 'WFH (Confirmed)',
  no_clocking: 'No Clocking',
  wrong_location: 'Wrong Location',
  broken_clocking: 'Broken Clocking',
  no_booking: 'No Booking',
  vacation: 'Vacation',
  public_holiday: 'Public Holiday',
  unknown: 'Unknown',
} as const

// ==========================================
// Compliance Flag Labels
// ==========================================

export const COMPLIANCE_FLAG_LABELS: Record<string, string> = {
  missing_clocking: 'Missing Clocking',
  missing_clock_out: 'Missing Clock Out',
  wrong_location: 'Wrong Location',
  no_desk_booking: 'No Desk Booking',
  late_arrival: 'Late Arrival',
  clocking_not_closed: 'Clocking Not Closed',
  schedule_mismatch: 'Schedule Mismatch',
  exceeded_wfh_days: 'Exceeded WFH Days',
} as const

// ==========================================
// User Roles
// ==========================================

export const USER_ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  HR_ADMIN: 'hr_admin',
  SUPER_ADMIN: 'super_admin',
} as const

// ==========================================
// Schedule Rule Types
// ==========================================

export const RULE_TYPES = {
  MAX_WFH_PER_DAY: 'MAX_WFH_PER_DAY',
  MAX_WFH_PER_DAY_OF_WEEK: 'MAX_WFH_PER_DAY_OF_WEEK',
  MIN_OFFICE_PER_TEAM: 'MIN_OFFICE_PER_TEAM',
} as const
