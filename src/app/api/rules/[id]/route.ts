import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { requireHrAdmin } from '@/lib/auth/require-hr-admin'
import { z } from 'zod'
import type { Database, Json } from '@/lib/types/database'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_RULE_TYPES = [
  'MAX_WFH_PER_DAY',
  'MAX_WFH_PER_DAY_OF_WEEK',
  'MIN_OFFICE_PER_TEAM',
] as const

type RuleType = (typeof VALID_RULE_TYPES)[number]
type RuleUpdate = Database['public']['Tables']['schedule_rules']['Update']

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

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  rule_type: z.enum(VALID_RULE_TYPES).optional(),
  value: z.unknown().optional(),
  applies_to_team_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ error: 'Invalid rule ID' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const update: RuleUpdate = {}

  if (parsed.data.name !== undefined) update.name = parsed.data.name
  if (parsed.data.applies_to_team_id !== undefined)
    update.applies_to_team_id = parsed.data.applies_to_team_id
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active

  if (parsed.data.value !== undefined) {
    // Determine rule_type for value validation
    let ruleType = parsed.data.rule_type
    if (!ruleType) {
      const { data: current, error: fetchErr } = await auth.client!
        .from('schedule_rules')
        .select('rule_type')
        .eq('id', id)
        .single()
      if (fetchErr || !current) {
        return Response.json({ error: 'Rule not found' }, { status: 404 })
      }
      ruleType = current.rule_type as RuleType
    }

    const validated = validateValue(ruleType, parsed.data.value)
    if (!validated.ok) {
      return Response.json({ error: validated.error }, { status: 400 })
    }
    update.value = validated.data
    if (parsed.data.rule_type) update.rule_type = parsed.data.rule_type
  } else if (parsed.data.rule_type !== undefined) {
    update.rule_type = parsed.data.rule_type
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('schedule_rules')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return Response.json({ error: 'Rule not found' }, { status: 404 })
    }
    console.error('[PATCH /api/rules/:id]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  return Response.json({ data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ error: 'Invalid rule ID' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('schedule_rules')
    .delete()
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return Response.json({ error: 'Rule not found' }, { status: 404 })
    }
    console.error('[DELETE /api/rules/:id]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  return Response.json({ data })
}
