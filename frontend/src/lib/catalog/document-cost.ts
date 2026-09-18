import type { PlanOut, PriceOut } from '@/lib/api/generated/model'

/** What a month of work costs on one plan, or why that plan cannot price it. */
export type DocumentCost =
  | {
      kind: 'amount'
      total: string
      perPage: string
      currency: string
      /** Present only when the volume ran past the plan's allowance. */
      overage?: { base: string; pages: number; rate: string }
    }
  | { kind: 'included' }
  | { kind: 'over-limit'; maxPages: number; per: 'document' | 'month' }
  | { kind: 'not-comparable' }

export type DocumentInput = { documents: number; pagesPerDocument: number }

/**
 * Amounts arrive as four-decimal strings and all arithmetic runs on integer
 * ten-thousandths.
 *
 * `0.05 * 3` is `0.15000000000000002` in IEEE 754, and `formatCost` reads its
 * precision off the string it is handed - so a float here does not just round
 * badly, it renders as `$0.1500`.
 */
const SCALE = 10_000

function toTenThousandths(amount: string): number {
  const [whole, fraction = ''] = amount.split('.')
  return Number(whole) * SCALE + Number(fraction.padEnd(4, '0').slice(0, 4))
}

function fromTenThousandths(value: number): string {
  return `${Math.floor(value / SCALE)}.${String(value % SCALE).padStart(4, '0')}`
}

/**
 * What the plan itself costs.
 *
 * A metered plan carries two current rows and the API returns them newest
 * first, so indexing into `prices` picks whichever was entered last - which on
 * PDF Redaction's Pro plan is the $0.05 overage, not the $15 fee.
 */
export function basePrice(plan: PlanOut): PriceOut | null {
  return plan.prices.find((price) => !price.is_overage) ?? null
}

/** What the plan charges per unit once its allowance runs out. */
export function overagePrice(plan: PlanOut): PriceOut | null {
  return plan.prices.find((price) => price.is_overage) ?? null
}

/** How many billable units one month of work consumes. */
const QUANTITY: Record<string, (input: DocumentInput) => number> = {
  page: (input) => input.documents * input.pagesPerDocument,
  // Page-count invariant, which is the whole point of the unit.
  document: (input) => input.documents,
}

/**
 * Units that buy a period rather than a quantity of work.
 *
 * With no published allowance the fee is all there is to say, so the honest
 * answer is "included" - not the fee divided by a volume nobody published.
 * That division is the mistake `apps/catalog/pricing.py` refuses to make.
 */
const SUBSCRIPTION = new Set(['month', 'year', 'seat_month', 'seat_year', 'one_time'])

/**
 * The tightest published cap of a kind.
 *
 * Plural because the table permits one row per label, so the same cap can be
 * recorded twice. The smallest is the one the reader will actually hit.
 */
function cap(plan: PlanOut, kind: string): number | null {
  const values = plan.limits
    .filter((limit) => limit.kind === kind && !limit.is_unlimited && limit.value !== null)
    .map((limit) => limit.value as number)
  return values.length ? Math.min(...values) : null
}

/**
 * What `input` costs a month on `plan`, and what that works out to per page.
 *
 * Both figures come out of one pass so the two columns can never disagree. A
 * metered plan is priced past its allowance at its published overage rate; a
 * plan that caps out with no such rate says so rather than quoting a figure it
 * would not honour.
 */
export function documentCost(plan: PlanOut, input: DocumentInput): DocumentCost {
  const base = basePrice(plan)
  if (!base) return { kind: 'not-comparable' }

  // A document longer than the plan allows has no price on that plan, and no
  // overage rate sells its way past a per-document cap.
  const perDocument = cap(plan, 'pages_per_document')
  if (perDocument !== null && input.pagesPerDocument > perDocument) {
    return { kind: 'over-limit', maxPages: perDocument, per: 'document' }
  }

  const totalPages = input.documents * input.pagesPerDocument
  const allowance = cap(plan, 'pages_per_month')
  const excess = allowance === null ? 0 : Math.max(0, totalPages - allowance)

  // Only a per-page overage is supported, because a monthly page allowance is
  // the only allowance the catalog records.
  const overage = overagePrice(plan)
  const metered = overage && overage.unit === 'page' ? overage : null

  if (excess > 0 && !metered) {
    return { kind: 'over-limit', maxPages: allowance as number, per: 'month' }
  }

  if (SUBSCRIPTION.has(base.unit)) {
    // Without an allowance the bill does not move with the volume, and saying
    // so beats printing a fee the reader pays either way.
    if (allowance === null) return { kind: 'included' }

    const billed = excess > 0 && metered ? metered : null
    const total =
      toTenThousandths(base.amount) + (billed ? excess * toTenThousandths(billed.amount) : 0)

    return {
      kind: 'amount',
      total: fromTenThousandths(total),
      perPage: fromTenThousandths(Math.round(total / totalPages)),
      currency: base.currency,
      ...(billed ? { overage: { base: base.amount, pages: excess, rate: billed.amount } } : {}),
    }
  }

  const quantity = QUANTITY[base.unit]
  if (!quantity) return { kind: 'not-comparable' }

  const total = toTenThousandths(base.amount) * quantity(input)

  return {
    kind: 'amount',
    total: fromTenThousandths(total),
    perPage: fromTenThousandths(Math.round(total / totalPages)),
    currency: base.currency,
  }
}
