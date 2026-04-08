export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: Run daily compliance engine with admin client
  return Response.json({ message: 'Daily compliance check not yet implemented' })
}
