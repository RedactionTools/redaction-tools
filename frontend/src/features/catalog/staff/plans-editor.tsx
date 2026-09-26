'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useStaffCreatePlan,
  useStaffGetTool,
  useStaffSetPlanLimit,
  useStaffSetPlanPrice,
  useStaffUpdatePlan,
} from '@/lib/api/generated/catalog-staff/catalog-staff'
import type { StaffPlanOut } from '@/lib/api/generated/model'

import { EditorActions } from './editor-actions'
import { useAfterStaffWrite } from './use-staff-write'

type Form = 'details' | 'price' | 'cap'

/**
 * Every plan on the listing, each with its own forms.
 *
 * A plan, its price and its caps are separate writes - the same split the
 * staff MCP makes - so each form saves on its own and none can half-succeed.
 */
export function PlansEditor({ slug, onDone }: { slug: string; onDone: () => void }) {
  const { data: record } = useStaffGetTool(slug)
  const [open, setOpen] = useState<{ code: string; form: Form } | null>(null)
  const [adding, setAdding] = useState(false)
  if (!record) return <Skeleton className="h-40 w-full" />

  const close = () => setOpen(null)

  return (
    <div className="space-y-6">
      {record.plans.map((plan) => (
        <section key={plan.code} className="space-y-3">
          <h3 className="font-medium">
            {plan.name} <span className="text-muted-foreground text-xs">({plan.code})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              aria-label={`Edit details of ${plan.name}`}
              onClick={() => setOpen({ code: plan.code, form: 'details' })}
            >
              Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Set the price of ${plan.name}`}
              onClick={() => setOpen({ code: plan.code, form: 'price' })}
            >
              Price
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Set a cap on ${plan.name}`}
              onClick={() => setOpen({ code: plan.code, form: 'cap' })}
            >
              Cap
            </Button>
          </div>
          {plan.limits.length ? (
            <ul className="text-muted-foreground text-sm">
              {plan.limits.map((limit) => (
                <li key={limit.kind}>
                  {limit.label}: {limit.value}
                </li>
              ))}
            </ul>
          ) : null}
          {open?.code === plan.code && open.form === 'details' ? (
            <PlanDetailsForm slug={slug} plan={plan} onDone={close} />
          ) : null}
          {open?.code === plan.code && open.form === 'price' ? (
            <PriceForm slug={slug} plan={plan} onDone={close} />
          ) : null}
          {open?.code === plan.code && open.form === 'cap' ? (
            <CapForm slug={slug} plan={plan} onDone={close} />
          ) : null}
        </section>
      ))}
      {adding ? (
        <AddPlanForm slug={slug} onDone={() => setAdding(false)} />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          Add a plan
        </Button>
      )}
      <div>
        <Button size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}

function PlanDetailsForm({
  slug,
  plan,
  onDone,
}: {
  slug: string
  plan: StaffPlanOut
  onDone: () => void
}) {
  const initial = detailsOf(plan)
  const [draft, setDraft] = useState(initial)
  const afterWrite = useAfterStaffWrite(slug)
  const save = useStaffUpdatePlan({
    mutation: { onSuccess: () => afterWrite().then(onDone) },
  })
  const changes = Object.fromEntries(
    Object.entries(valuesOf(draft)).filter(
      ([field, value]) =>
        JSON.stringify(value) !== JSON.stringify(valuesOf(initial)[field as keyof Details]),
    ),
  )
  const id = (field: string) => `plan-${plan.code}-${field}`
  const set = (change: Partial<Details>) => setDraft((current) => ({ ...current, ...change }))

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({ slug, code: plan.code, data: { changes } })
      }}
    >
      <Field id={id('name')} label="Plan name">
        <Input
          id={id('name')}
          value={draft.name}
          onChange={(event) => set({ name: event.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={id('tier_order')} label="Tier order">
          <Input
            id={id('tier_order')}
            type="number"
            min={0}
            value={draft.tier_order}
            onChange={(event) => set({ tier_order: event.target.value })}
          />
        </Field>
        <Field id={id('min_seats')} label="Minimum seats">
          <Input
            id={id('min_seats')}
            type="number"
            min={1}
            value={draft.min_seats}
            onChange={(event) => set({ min_seats: event.target.value })}
          />
        </Field>
        <Field id={id('trial_days')} label="Trial days">
          <Input
            id={id('trial_days')}
            type="number"
            min={0}
            value={draft.trial_days}
            onChange={(event) => set({ trial_days: event.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {FLAGS.map(([flag, label]) => (
          <label key={flag} className="flex items-center gap-2">
            <Checkbox
              checked={draft[flag]}
              onChange={(event) => set({ [flag]: event.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <Field id={id('highlights')} label="Highlights, one per line">
        <Textarea
          id={id('highlights')}
          rows={3}
          value={draft.highlights}
          onChange={(event) => set({ highlights: event.target.value })}
        />
      </Field>
      <Field id={id('source_url')} label="Source page">
        <Input
          id={id('source_url')}
          value={draft.source_url}
          onChange={(event) => set({ source_url: event.target.value })}
        />
      </Field>
      <EditorActions
        error={save.error}
        pending={save.isPending}
        disabled={Object.keys(changes).length === 0}
        onCancel={onDone}
      />
    </form>
  )
}

// Mirrors `PlanLimitKind` in the backend's models.
const CAP_KINDS = [
  ['pages_per_document', 'Pages per document'],
  ['pages_per_month', 'Pages per month'],
  ['documents_per_month', 'Documents per month'],
  ['minutes_per_month', 'Minutes per month'],
  ['file_size_mb', 'Maximum file size (MB)'],
  ['seats', 'Seats'],
  ['retention_days', 'File retention (days)'],
  ['api_calls_per_month', 'API calls per month'],
  ['other', 'Other'],
] as const

/**
 * One published cap. An upsert on (plan, kind), so correcting a figure moves
 * it. A cap with no number, not unlimited and no note is refused by the API:
 * "not published" is a claim about the vendor, not a blank field.
 */
function CapForm({ slug, plan, onDone }: { slug: string; plan: StaffPlanOut; onDone: () => void }) {
  const [draft, setDraft] = useState({
    kind: 'pages_per_month',
    value: '',
    is_unlimited: false,
    note: '',
  })
  const afterWrite = useAfterStaffWrite(slug)
  const save = useStaffSetPlanLimit({
    mutation: { onSuccess: () => afterWrite().then(onDone) },
  })
  const id = (field: string) => `cap-${plan.code}-${field}`
  const set = (change: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...change }))

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({
          slug,
          code: plan.code,
          kind: draft.kind,
          data: {
            value: draft.value === '' ? null : Number(draft.value),
            is_unlimited: draft.is_unlimited,
            note: draft.note,
          },
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={id('kind')} label="Kind">
          <Select
            id={id('kind')}
            value={draft.kind}
            onChange={(event) => set({ kind: event.target.value })}
          >
            {CAP_KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id('value')} label="Value">
          <Input
            id={id('value')}
            type="number"
            min={0}
            value={draft.value}
            disabled={draft.is_unlimited}
            onChange={(event) => set({ value: event.target.value })}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={draft.is_unlimited}
          onChange={(event) => set({ is_unlimited: event.target.checked, value: '' })}
        />
        Unlimited
      </label>
      <Field id={id('note')} label="Note">
        <Input
          id={id('note')}
          value={draft.note}
          onChange={(event) => set({ note: event.target.value })}
        />
      </Field>
      <EditorActions error={save.error} pending={save.isPending} onCancel={onDone} />
    </form>
  )
}

/**
 * A new plan is a shell until it has a price, a free-tier flag or the quote
 * flag - invisible to the catalog - so the form says so rather than closing
 * as if the job were done.
 */
function AddPlanForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const afterWrite = useAfterStaffWrite(slug)
  const create = useStaffCreatePlan({ mutation: { onSuccess: () => afterWrite() } })

  if (create.data) {
    return (
      <div className="space-y-2" role="status">
        <p className="text-sm">
          Added {create.data.name}.
          {create.data.has_pricing_position
            ? null
            : ' It has no price yet, so it is not shown: set one with its Price button.'}
        </p>
        <Button size="sm" variant="outline" onClick={onDone}>
          OK
        </Button>
      </div>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        create.mutate({ slug, data: { code, name, changes: {} } })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="new-plan-code" label="Code">
          <Input
            id="new-plan-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <Field id="new-plan-name" label="New plan name">
          <Input
            id="new-plan-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </div>
      <p className="text-muted-foreground text-xs">
        The code is what the crawler matches on and cannot be changed afterwards.
      </p>
      <EditorActions
        error={create.error}
        pending={create.isPending}
        disabled={!code || !name}
        onCancel={onDone}
        saveLabel="Create plan"
      />
    </form>
  )
}

// Mirrors `PriceUnit` and `BillingPeriod` in the backend's models, which refuse
// anything else by name; the spec types both as plain strings.
const UNITS = [
  ['month', 'Per month'],
  ['year', 'Per year'],
  ['seat_month', 'Per seat per month'],
  ['seat_year', 'Per seat per year'],
  ['page', 'Per page'],
  ['document', 'Per document'],
  ['minute', 'Per minute'],
  ['credit', 'Per credit'],
  ['one_time', 'One-time'],
] as const

const PERIODS = [
  ['monthly', 'Monthly'],
  ['annual', 'Annual'],
  ['one_time', 'One-time'],
  ['usage', 'Usage-based'],
  ['none', 'None'],
] as const

/**
 * Publish a figure. Never an edit: the service closes the current row in the
 * same (currency, period, overage) slot and opens a new one, so the page's
 * price history records the change - and an overage rate in another slot
 * survives a change to the plan's own price.
 */
function PriceForm({
  slug,
  plan,
  onDone,
}: {
  slug: string
  plan: StaffPlanOut
  onDone: () => void
}) {
  const current = plan.prices.find((price) => !price.is_overage) ?? plan.prices[0]
  const [draft, setDraft] = useState({
    amount: current?.amount ?? '',
    unit: current?.unit ?? 'month',
    billing_period: current?.billing_period ?? 'monthly',
    currency: current?.currency ?? 'USD',
    is_overage: current?.is_overage ?? false,
    source_note: '',
    source_evidence_url: '',
  })
  const afterWrite = useAfterStaffWrite(slug)
  const save = useStaffSetPlanPrice({
    mutation: { onSuccess: () => afterWrite().then(onDone) },
  })
  const id = (field: string) => `price-${plan.code}-${field}`
  const set = (change: Partial<typeof draft>) =>
    setDraft((currentDraft) => ({ ...currentDraft, ...change }))

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({ slug, code: plan.code, data: draft })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Field id={id('amount')} label="Amount">
          <Input
            id={id('amount')}
            inputMode="decimal"
            value={draft.amount}
            onChange={(event) => set({ amount: event.target.value })}
          />
        </Field>
        <Field id={id('currency')} label="Currency">
          <Input
            id={id('currency')}
            maxLength={3}
            value={draft.currency}
            onChange={(event) => set({ currency: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field id={id('unit')} label="Unit">
          <Select
            id={id('unit')}
            value={draft.unit}
            onChange={(event) => set({ unit: event.target.value })}
          >
            {UNITS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id('billing_period')} label="Billing period">
          <Select
            id={id('billing_period')}
            value={draft.billing_period}
            onChange={(event) => set({ billing_period: event.target.value })}
          >
            {PERIODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={draft.is_overage}
          onChange={(event) => set({ is_overage: event.target.checked })}
        />
        Overage rate (charged beyond the allowance)
      </label>
      <Field id={id('source_note')} label="Where the figure comes from">
        <Input
          id={id('source_note')}
          value={draft.source_note}
          onChange={(event) => set({ source_note: event.target.value })}
        />
      </Field>
      <Field id={id('source_evidence_url')} label="Evidence URL">
        <Input
          id={id('source_evidence_url')}
          value={draft.source_evidence_url}
          onChange={(event) => set({ source_evidence_url: event.target.value })}
        />
      </Field>
      <p className="text-muted-foreground text-xs">
        Publishing replaces the current figure in the same currency, period and overage slot. The
        old one stays in the price history.
      </p>
      <EditorActions
        error={save.error}
        pending={save.isPending}
        disabled={!draft.amount}
        onCancel={onDone}
        saveLabel="Publish price"
      />
    </form>
  )
}

const FLAGS = [
  ['is_public', 'Shown on the page'],
  ['is_free_tier', 'Free tier'],
  ['is_trial', 'Trial'],
  ['is_enterprise_quote', 'Quote only'],
] as const

type Details = {
  name: string
  tier_order: string
  min_seats: string
  trial_days: string
  is_public: boolean
  is_free_tier: boolean
  is_trial: boolean
  is_enterprise_quote: boolean
  highlights: string
  source_url: string
}

function detailsOf(plan: StaffPlanOut): Details {
  return {
    name: plan.name,
    tier_order: String(plan.tier_order),
    min_seats: String(plan.min_seats),
    trial_days: plan.trial_days === null ? '' : String(plan.trial_days),
    is_public: plan.is_public,
    is_free_tier: plan.is_free_tier,
    is_trial: plan.is_trial,
    is_enterprise_quote: plan.is_enterprise_quote,
    highlights: plan.highlights.join('\n'),
    source_url: plan.source_url,
  }
}

/** The draft as the API types it: numbers as numbers, lines as a list. */
function valuesOf(draft: Details) {
  return {
    ...draft,
    tier_order: Number(draft.tier_order),
    min_seats: Number(draft.min_seats),
    trial_days: draft.trial_days === '' ? null : Number(draft.trial_days),
    highlights: draft.highlights
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  }
}

export function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  )
}
