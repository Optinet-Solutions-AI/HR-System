// Compliance Engine — Core business logic
// Triggered daily by pg_cron calling /api/cron/daily-compliance
// Uses admin client (bypasses RLS) for full data access
//
// Produces one compliance_record per employee per working day:
// 1. Skip weekends (unless explicitly scheduled)
// 2. Skip public holidays
// 3. Skip approved vacation
// 4. Get expected status from schedules
// 5. Get actual clocking from Talexio
// 6. Get booking data
// 7. Validate GPS location against office geofence
// 8. Determine actual status and generate flags
// 9. Check weekly/monthly WFH limits
// 10. Upsert compliance_record

// TODO: implement
