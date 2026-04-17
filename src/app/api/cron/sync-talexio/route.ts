import { syncClockings } from '@/lib/talexio/sync'

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

async function handleSync() {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(new Date())

  try {
    const result = await syncClockings(date)
    return Response.json({ date, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/sync-talexio]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleSync()
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleSync()
}
