import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { requireHrAdmin } from '@/lib/auth/require-hr-admin'
import { z } from 'zod'
import type { Json } from '@/lib/types/database'

const VALID_RULE_TYPES = [
  'MAX_WFH_PER_DAY',
  'MAX_WFH_PER_DAY_OF_WEEK',
  'MIN_OFFICE_PER_TEAM',
] as const

type RuleType = (typeof VALID_RULE_TYPES)[number]

function validateValue(
  ruleType: RuleType,
  value: unknown
): { ok: true; data: Json } | { ok: false; error: string } {
  switch (ruleType) {
    case 'MAX_WFH_PER_DAY': {
      const r = z.object({ maxCount: z.number().int().min(1) }).safeParse(value)
      return r.success
        ? { ok: true, data: r.data as Json }
        : { ok: false, error: 'MAX_WFH_PER_DAY requires { maxCount: number (≥1) }' }
    }
    case 'MAX_WFH_PER_DAY_OF_WEEK': {
      const r = z
        .object({
          dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
          maxPerMonth: z.number().int().min(0),
        })
        .safeParse(value)
      return r.success
        ? { ok: true, data: r.data as Json }
        : { ok: false, error: 'MAX_WFH_PER_DAY_OF_WEEK requires { dayOfWeek, maxPerMonth: number }' }
    }
    case 'MIN_OFFICE_PER_TEAM': {
      const r = z.object({ minCount: z.number().int().min(1) }).safeParse(value)
      return r.success
        ? { ok: true, data: r.data as Json }
        : { ok: false, error: 'MIN_OFFICE_PER_TEAM requires { minCount: number (≥1) }' }
    }
  }
}

const createRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  rule_type: z.enum(VALID_RULE_TYPES),
  value: z.unknown(),
  applies_to_team_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function GET() {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.client!
    .from('schedule_rules')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[GET /api/rules]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
  return Response.json({ data })
}

export async function POST(request: Request) {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createRuleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const validated = validateValue(parsed.data.rule_type, parsed.data.value)
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('schedule_rules')
    .insert({
      name: parsed.data.name,
      rule_type: parsed.data.rule_type,
      value: validated.data,
      applies_to_team_id: parsed.data.applies_to_team_id ?? null,
      is_active: parsed.data.is_active ?? true,
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/rules]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  return Response.json({ data }, { status: 201 })
}
