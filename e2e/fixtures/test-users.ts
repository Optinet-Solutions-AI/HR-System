export const TEST_USERS = {
  employee4d: {
    email: 'e2e.emp4d@test.local',
    password: 'E2eTestPass1!',
    firstName: 'E2E',
    lastName: 'Emp4d',
    talexioId: 'E2E_EMP4D',
    officeDaysPerWeek: 4,
    role: 'employee' as const,
  },
  employee5d: {
    email: 'e2e.emp5d@test.local',
    password: 'E2eTestPass1!',
    firstName: 'E2E',
    lastName: 'Emp5d',
    talexioId: 'E2E_EMP5D',
    officeDaysPerWeek: 5,
    role: 'employee' as const,
  },
  hradmin: {
    email: 'e2e.hradmin@test.local',
    password: 'E2eTestPass1!',
    firstName: 'E2E',
    lastName: 'HrAdmin',
    talexioId: 'E2E_HRADMIN',
    officeDaysPerWeek: 4,
    role: 'hr_admin' as const,
  },
} as const

export type TestUserKey = keyof typeof TEST_USERS
