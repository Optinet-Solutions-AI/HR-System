'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RULE_TYPES } from '@/lib/constants'
import type { ScheduleRule } from '@/lib/types/app'

type RuleType = (typeof RULE_TYPES)[keyof typeof RULE_TYPES]

type TeamOption = { id: string; name: string }

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  MAX_WFH_PER_DAY: 'Max WFH Per Day',
  MAX_WFH_PER_DAY_OF_WEEK: 'Max WFH Day of Week',
  MIN_OFFICE_PER_TEAM: 'Min Office Per Team',
}

const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

function formatRuleValue(ruleType: string, value: unknown): string {
  const v = value as Record<string, unknown>
  switch (ruleType) {
    case 'MAX_WFH_PER_DAY':
      return `Max ${v.maxCount} WFH employees/day`
    case 'MAX_WFH_PER_DAY_OF_WEEK':
      return `Max ${v.maxPerMonth} WFH ${v.dayOfWeek}s/month`
    case 'MIN_OFFICE_PER_TEAM':
      return `Min ${v.minCount} in office/day`
    default:
      return JSON.stringify(value)
  }
}

interface RuleForm {
  name: string
  rule_type: RuleType
  is_active: boolean
  applies_to_team_id: string | null
  // MAX_WFH_PER_DAY
  maxCount: number
  // MAX_WFH_PER_DAY_OF_WEEK
  dayOfWeek: string
  maxPerMonth: number
  // MIN_OFFICE_PER_TEAM
  minCount: number
}

const DEFAULT_FORM: RuleForm = {
  name: '',
  rule_type: 'MAX_WFH_PER_DAY',
  is_active: true,
  applies_to_team_id: null,
  maxCount: 3,
  dayOfWeek: 'Monday',
  maxPerMonth: 1,
  minCount: 1,
}

function ruleToForm(rule: ScheduleRule): RuleForm {
  const v = rule.value as Record<string, unknown>
  return {
    name: rule.name,
    rule_type: rule.rule_type as RuleType,
    is_active: rule.is_active,
    applies_to_team_id: rule.applies_to_team_id,
    maxCount: typeof v.maxCount === 'number' ? v.maxCount : 3,
    dayOfWeek: typeof v.dayOfWeek === 'string' ? v.dayOfWeek : 'Monday',
    maxPerMonth: typeof v.maxPerMonth === 'number' ? v.maxPerMonth : 1,
    minCount: typeof v.minCount === 'number' ? v.minCount : 1,
  }
}

function buildValue(form: RuleForm): Record<string, unknown> {
  switch (form.rule_type) {
    case 'MAX_WFH_PER_DAY':
      return { maxCount: form.maxCount }
    case 'MAX_WFH_PER_DAY_OF_WEEK':
      return { dayOfWeek: form.dayOfWeek, maxPerMonth: form.maxPerMonth }
    case 'MIN_OFFICE_PER_TEAM':
      return { minCount: form.minCount }
  }
}

interface RulesPanelProps {
  rules: ScheduleRule[]
  teams: TeamOption[]
}

export function RulesPanel({ rules, teams }: RulesPanelProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null)
  const [form, setForm] = useState<RuleForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    if (dialogOpen) {
      setForm(editingRule ? ruleToForm(editingRule) : DEFAULT_FORM)
    }
  }, [dialogOpen, editingRule])

  function openAdd() {
    setEditingRule(null)
    setDialogOpen(true)
  }

  function openEdit(rule: ScheduleRule) {
    setEditingRule(rule)
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        rule_type: form.rule_type,
        value: buildValue(form),
        applies_to_team_id: form.applies_to_team_id,
        is_active: form.is_active,
      }

      const url = editingRule ? `/api/rules/${editingRule.id}` : '/api/rules'
      const method = editingRule ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.error === 'string' ? err.error : 'Operation failed')
      }

      toast.success(editingRule ? `Updated "${form.name.trim()}"` : `Added "${form.name.trim()}"`)
      setDialogOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(rule: ScheduleRule) {
    setTogglingId(rule.id)
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to update rule')
      }
      toast.success(rule.is_active ? `Deactivated "${rule.name}"` : `Activated "${rule.name}"`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle rule')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(rule: ScheduleRule) {
    setDeletingId(rule.id)
    try {
      const res = await fetch(`/api/rules/${rule.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to delete rule')
      }
      toast.success(`Deleted "${rule.name}"`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete rule')
    } finally {
      setDeletingId(null)
    }
  }

  function renderValueFields() {
    switch (form.rule_type) {
      case 'MAX_WFH_PER_DAY':
        return (
          <div className="grid gap-2">
            <Label htmlFor="maxCount">Max WFH Employees Per Day (org-wide)</Label>
            <Input
              id="maxCount"
              type="number"
              min={1}
              max={100}
              value={form.maxCount}
              onChange={(e) =>
                setForm({ ...form, maxCount: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
            />
            <p className="text-xs text-muted-foreground">
              Maximum employees who can WFH on any given day across the organisation.
            </p>
          </div>
        )

      case 'MAX_WFH_PER_DAY_OF_WEEK':
        return (
          <>
            <div className="grid gap-2">
              <Label>Day of Week</Label>
              <Select
                value={form.dayOfWeek}
                onValueChange={(val) => setForm({ ...form, dayOfWeek: val ?? form.dayOfWeek })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxPerMonth">Max WFH Per Month</Label>
              <Input
                id="maxPerMonth"
                type="number"
                min={0}
                max={20}
                value={form.maxPerMonth}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxPerMonth: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum times an employee can WFH on {form.dayOfWeek} per month.
              </p>
            </div>
          </>
        )

      case 'MIN_OFFICE_PER_TEAM':
        return (
          <>
            <div className="grid gap-2">
              <Label>Team</Label>
              <Select
                value={form.applies_to_team_id ?? ''}
                onValueChange={(val) =>
                  setForm({ ...form, applies_to_team_id: val || null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team…" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minCount">Min Employees in Office Per Day</Label>
              <Input
                id="minCount"
                type="number"
                min={1}
                max={50}
                value={form.minCount}
                onChange={(e) =>
                  setForm({ ...form, minCount: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum team members who must be in the office on any given day.
              </p>
            </div>
          </>
        )
    }
  }

  const isEditing = editingRule !== null
  const canSubmit =
    form.name.trim() !== '' &&
    (form.rule_type !== 'MIN_OFFICE_PER_TEAM' || form.applies_to_team_id !== null)

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">Active Rules</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rules.filter(r => r.is_active).length} active of {rules.length} total
            </p>
          </div>
          <Button size="sm" onClick={openAdd} className="h-8 rounded-lg px-4 text-xs font-semibold w-full sm:w-auto">
            <Plus className="size-4 mr-1.5" />
            Add Rule
          </Button>
        </div>

        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="rounded-lg border border-border/60 min-w-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Name</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Type</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Value</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Scope</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ShieldOff className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm">No schedule rules configured</p>
                      <p className="text-xs">Add a rule to start enforcing scheduling constraints</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id} className={`transition-opacity ${rule.is_active ? '' : 'opacity-45'}`}>
                    <TableCell className="font-medium text-sm">{rule.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {RULE_TYPE_LABELS[rule.rule_type as RuleType] ?? rule.rule_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRuleValue(rule.rule_type, rule.value)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rule.applies_to_team_id ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          {teams.find((t) => t.id === rule.applies_to_team_id)?.name ?? '—'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Global</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        disabled={togglingId === rule.id}
                        onClick={() => handleToggle(rule)}
                        className="cursor-pointer disabled:cursor-not-allowed"
                        aria-label={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                      >
                        <Badge
                          className={`text-[11px] font-medium transition-colors ${
                            rule.is_active
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {togglingId === rule.id ? (
                            '…'
                          ) : rule.is_active ? (
                            <><ShieldCheck className="mr-1 size-3" />Active</>
                          ) : (
                            'Inactive'
                          )}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(rule)}
                          className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg"
                          aria-label={`Edit ${rule.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={deletingId === rule.id}
                          onClick={() => handleDelete(rule)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          aria-label={`Delete ${rule.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? `Edit "${editingRule?.name}"` : 'Add Schedule Rule'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the rule name, value, and active state.'
                : 'Select a rule type and configure its parameters.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid gap-2">
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  placeholder="e.g. Monday WFH limit"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Rule Type — selectable when creating, locked when editing */}
              <div className="grid gap-2">
                <Label>Rule Type</Label>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground">
                      {RULE_TYPE_LABELS[form.rule_type] ?? form.rule_type}
                    </span>
                    <span className="text-xs text-muted-foreground">(cannot be changed)</span>
                  </div>
                ) : (
                  <Select
                    value={form.rule_type}
                    onValueChange={(val) =>
                      setForm({ ...form, rule_type: val as RuleType, applies_to_team_id: null })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(RULE_TYPES) as Array<keyof typeof RULE_TYPES>).map((key) => (
                        <SelectItem key={key} value={RULE_TYPES[key]}>
                          {RULE_TYPE_LABELS[RULE_TYPES[key]]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Adaptive value fields */}
              {renderValueFields()}

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <input
                  id="rule-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <Label htmlFor="rule-active">Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || saving}>
                {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
