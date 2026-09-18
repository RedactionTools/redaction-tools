'use client'

import { type ReactNode, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PlanOut, ToolDetailOut } from '@/lib/api/generated/model'
import {
  basePrice,
  cheapestPlan,
  documentCost,
  type DocumentInput,
} from '@/lib/catalog/document-cost'
import { formatCost } from '@/lib/catalog/format'

import { PriceProvenanceBadge } from './price-provenance-badge'
import { planPrice } from './tool-profile'

/** The volumes the catalog gets asked about, kept to one click each. Typing a
 *  number the presets do not cover stays the point of the field beside them. */
const DOCUMENT_PRESETS = [10, 100, 1000]
const PAGE_PRESETS = [1, 10, 25, 100]

const MAX = 10_000

/** Whole numbers only, at least one, and capped so a stray keystroke cannot
 *  produce a figure nobody could act on. */
function clamp(value: string): number | '' {
  if (value.trim() === '') return ''
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return ''
  return Math.min(MAX, Math.max(1, parsed))
}

/** A number field with its common values as buttons beside it. */
function VolumeField({
  id,
  label,
  unit,
  presets,
  value,
  onChange,
}: {
  id: string
  label: string
  unit: [singular: string, plural: string]
  presets: number[]
  value: number | ''
  onChange: (value: number | '') => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-muted-foreground text-sm" htmlFor={id}>
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          type="number"
          min={1}
          max={MAX}
          step={1}
          className="w-28"
          value={value}
          onChange={(event) => onChange(clamp(event.target.value))}
        />
        {presets.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant={value === preset ? 'primary' : 'outline'}
            size="sm"
            aria-pressed={value === preset}
            onClick={() => onChange(preset)}
          >
            {preset.toLocaleString('en-US')} {preset === 1 ? unit[0] : unit[1]}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** The reader's half of the arithmetic, as state two callers can hold. */
export type Volume = { documents: number | ''; pages: number | '' }

export const DEFAULT_VOLUME: Volume = { documents: 10, pages: 10 }

/** An empty field prices as one rather than as nothing, so a mid-edit backspace
 *  leaves the table showing a figure instead of blanking it. */
export function volumeInput(volume: Volume): DocumentInput {
  return {
    documents: volume.documents === '' ? 1 : volume.documents,
    pagesPerDocument: volume.pages === '' ? 1 : volume.pages,
  }
}

/** Both volume fields. Lifted out of the table so the calculator page can ask
 *  for the volume before the reader has settled on a tool. */
export function VolumeFields({
  volume,
  onChange,
}: {
  volume: Volume
  onChange: (volume: Volume) => void
}) {
  return (
    <div className="space-y-4">
      <VolumeField
        id="cost-documents"
        label="Documents a month"
        unit={['document', 'documents']}
        presets={DOCUMENT_PRESETS}
        value={volume.documents}
        onChange={(documents) => onChange({ ...volume, documents })}
      />
      <VolumeField
        id="cost-pages"
        label="Pages per document"
        unit={['page', 'pages']}
        presets={PAGE_PRESETS}
        value={volume.pages}
        onChange={(pages) => onChange({ ...volume, pages })}
      />
    </div>
  )
}

function CostCells({ plan, input }: { plan: PlanOut; input: DocumentInput }) {
  const cost = documentCost(plan, input)

  if (cost.kind === 'amount') {
    return (
      <>
        <TableCell className="font-medium tabular-nums">
          {formatCost(cost.total, cost.currency)}
          {cost.overage ? (
            // The sum is shown, not just its answer: a bill that jumped because
            // the allowance ran out should say so on the row that jumped.
            <span className="text-muted-foreground block text-xs font-normal">
              {formatCost(cost.overage.base, cost.currency)} +{' '}
              {cost.overage.pages.toLocaleString('en-US')} over ×{' '}
              {formatCost(cost.overage.rate, cost.currency)}
            </span>
          ) : null}
        </TableCell>
        <TableCell className="tabular-nums">{formatCost(cost.perPage, cost.currency)}</TableCell>
      </>
    )
  }

  if (cost.kind === 'included') {
    // Never the monthly fee divided by a volume: the plan covers the work, and
    // that is the whole of what we can honestly say.
    return (
      <TableCell className="text-muted-foreground" colSpan={2}>
        Included in the plan
      </TableCell>
    )
  }

  if (cost.kind === 'over-limit') {
    return (
      <TableCell className="text-muted-foreground" colSpan={2}>
        {cost.per === 'month'
          ? `Over this plan's ${cost.maxPages} pages a month`
          : `Over this plan's ${cost.maxPages}-page document limit`}
      </TableCell>
    )
  }

  return (
    <TableCell className="text-muted-foreground" colSpan={2}>
      —
    </TableCell>
  )
}

/**
 * The costed plans, as a table.
 *
 * Shared with the example preview on the calculator page, which is the point:
 * a preview of the answer is only worth showing if it is the same table the
 * real figures land in.
 *
 * `tool` is what makes a row's published price quotable - without it there is
 * no provenance to badge, which is exactly the case for invented example rates.
 */
export function CostTable({
  plans,
  input,
  tool,
  caption,
}: {
  plans: PlanOut[]
  input: DocumentInput
  tool?: ToolDetailOut
  caption: ReactNode
}) {
  // Recomputed per render rather than memoised: it is one pass over a handful
  // of plans, and the volume it depends on changes on every keystroke anyway.
  const cheapest = cheapestPlan(plans, input)

  return (
    <Table>
      <TableCaption>{caption}</TableCaption>
      <TableHead>
        <TableRow>
          <TableHeader>Plan</TableHeader>
          <TableHeader>Published price</TableHeader>
          <TableHeader>Total</TableHeader>
          <TableHeader>Per page</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {plans.map((plan) => (
          <TableRow
            key={plan.code}
            data-testid={`cost-row-${plan.code}`}
            data-cheapest={cheapest.includes(plan.code) || undefined}
            // The whole row, so the tint reads as "this line is the answer"
            // rather than decorating one cell. `ok-subtle` because the catalog
            // already spends that tone on a verified, favourable finding.
            className={cheapest.includes(plan.code) ? 'bg-ok-subtle' : undefined}
          >
            <TableCell className="font-medium">
              <span className="flex flex-wrap items-center gap-2">
                {plan.name}
                {/* Named, not just tinted: the answer has to survive a screen
                    reader, a monochrome print and a reader who cannot tell the
                    tint from the stripe. */}
                {cheapest.includes(plan.code) ? (
                  <Badge tone="ok">
                    {cheapest.length > 1 ? 'Joint cheapest' : 'Cheapest'} for this volume
                  </Badge>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">
              <span className="flex items-center gap-2">
                {planPrice(plan)}
                {tool && basePrice(plan) ? (
                  <PriceProvenanceBadge
                    summary={{ ...tool.price_summary, source: basePrice(plan)!.source }}
                    slug={`${tool.slug}-${plan.code}-cost`}
                  />
                ) : null}
              </span>
            </TableCell>
            <CostCells plan={plan} input={input} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export const COST_CAPTION = (
  <>
    Worked out from each plan&apos;s published rate, reading the figures above as one month&apos;s
    work. Subscription plans read <em>Included in the plan</em> rather than a per-document figure: a
    monthly fee is not a per-document price, and dividing one into the other would need a volume no
    vendor publishes. A metered plan is priced past its allowance at its published overage rate; one
    that caps out with no such rate says so instead of quoting a price it would not honour.
  </>
)

/**
 * What a job actually costs, per plan.
 *
 * The catalog will not turn a per-page rate into a monthly one because that
 * needs a volume nobody published. Here the reader supplies the volume, so the
 * arithmetic is theirs rather than ours - and the per-page column shows where
 * per-document pricing overtakes per-page, which no published rate reveals.
 *
 * Pass `input` to drive it from volume fields rendered elsewhere, as the
 * calculator page does; left off, it owns the volume and renders its own, which
 * is what a tool profile wants.
 */
export function DocumentCostCalculator({
  tool,
  input: controlled,
}: {
  tool: ToolDetailOut
  input?: DocumentInput
}) {
  const [volume, setVolume] = useState<Volume>(DEFAULT_VOLUME)
  const input = controlled ?? volumeInput(volume)

  return (
    <section className="space-y-4" data-testid="document-cost-calculator">
      <h2 className="text-xl font-semibold">What will it cost?</h2>
      {/* The calculator page asks for the volume once, above the tool picker,
          so the fields would be a second set of the same controls there. */}
      {controlled ? null : <VolumeFields volume={volume} onChange={setVolume} />}

      <CostTable plans={tool.plans} input={input} tool={tool} caption={COST_CAPTION} />
    </section>
  )
}
