// Talexio Sync Service
// 1. Fetch clockings from Talexio API for current date
// 2. Map Talexio employee IDs to our employee_id (via talexio_id)
// 3. Upsert into clockings table (on conflict employee_id + date)
// 4. Log: records synced, new records, errors
// 5. Handle missing employees gracefully (log warning, don't crash)

// TODO: implement
