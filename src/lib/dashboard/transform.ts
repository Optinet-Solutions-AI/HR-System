import type {
  DashboardData,
  DashboardEmployeeRow,
  DashboardStatusCounts,
  ActualStatus,
  ScheduleStatus,
  ComplianceFlag,
} from '@/lib/types/app'

type EmployeeInput = { id: string; first_name: string; last_name: string }
type ScheduleInput = { employee_id: string; status: ScheduleStatus }
type ClockingInput = { employee_id: string; time_in: string | null; time_out: string | null }
type ComplianceInput = {
  employee_id: string
  actual_status: ActualStatus
  is_compliant: boolean
  flags: ComplianceFlag[] | null
  expected_status: ScheduleStatus | null
}

export function transformDashboardData(
  employees: EmployeeInput[],
  schedules: ScheduleInput[],
  clockings: ClockingInput[],
  complianceRecords: ComplianceInput[],
  todayDate: string,
): DashboardData {
  const scheduleMap = new Map(schedules.map((s) => [s.employee_id, s]))
  const clockingMap = new Map(clockings.map((c) => [c.employee_id, c]))
  const complianceMap = new Map(complianceRecords.map((cr) => [cr.employee_id, cr]))

  // Employees scheduled for office/wfh but with no compliance record yet (engine hasn't run)
  let notClockedFallback = 0
  for (const emp of employees) {
    const schedule = scheduleMap.get(emp.id)
    if (
      schedule &&
      (schedule.status === 'office' || schedule.status === 'wfh') &&
      !complianceMap.has(emp.id) &&
      !clockingMap.has(emp.id)
    ) {
      notClockedFallback++
    }
  }

  const counts: DashboardStatusCounts = {
    inOffice: complianceRecords.filter((cr) => cr.actual_status === 'in_office_confirmed').length,
    wfh: complianceRecords.filter((cr) => cr.actual_status === 'wfh_confirmed').length,
    notClocked:
      complianceRecords.filter((cr) => cr.actual_status === 'no_clocking').length +
      notClockedFallback,
    onLeave: schedules.filter(
      (s) => s.status === 'vacation' || s.status === 'sick_leave',
    ).length,
    flagged: complianceRecords.filter((cr) => !cr.is_compliant).length,
  }

  const employeeRows: DashboardEmployeeRow[] = employees.map((emp) => {
    const schedule = scheduleMap.get(emp.id)
    const clocking = clockingMap.get(emp.id)
    const compliance = complianceMap.get(emp.id)

    return {
      employeeId: emp.id,
      firstName: emp.first_name,
      lastName: emp.last_name,
      expectedStatus: schedule?.status ?? compliance?.expected_status ?? null,
      actualStatus: compliance?.actual_status ?? null,
      timeIn: clocking?.time_in ?? null,
      timeOut: clocking?.time_out ?? null,
      flags: compliance?.flags ?? [],
      isCompliant: compliance?.is_compliant ?? null,
    }
  })

  return { counts, employees: employeeRows, todayDate }
}
