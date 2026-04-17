import { runCompliance } from '@/lib/compliance/engine'

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

async function handleCompliance() {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(yesterday)

  try {
    const result = await runCompliance(date, date)
    return Response.json({ date, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/daily-compliance]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleCompliance()
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleCompliance()
}
