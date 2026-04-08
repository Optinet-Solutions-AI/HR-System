export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: Run Talexio sync with admin client
  return Response.json({ message: 'Talexio sync not yet implemented' })
}
