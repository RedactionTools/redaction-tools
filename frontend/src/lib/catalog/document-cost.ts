import type { PlanOut, PriceOut } from '@/lib/api/generated/model'

/** What a month of work costs on one plan, or why that plan cannot price it. */
export type DocumentCost =
  | {
      kind: 'amount'
      total: string
      perPage: string
      currency: string
      /** Present only when the volume ran past the plan's allowance. */
      overage?: { base: string; over: number; counts: 'pages' | 'documents'; rate: string }
    }
  | { kind: 'included' }
  /** `counts` is the unit the cap is published in: a plan may cap pages, or
   *  documents, and saying "pages" of a document cap misreads the vendor. */
  | { kind: 'over-limit'; max: number; counts: 'pages' | 'documents'; per: 'document' | 'month' }
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
    return { kind: 'over-limit', max: perDocument, counts: 'pages', per: 'document' }
  }

  const totalPages = input.documents * input.pagesPerDocument

  // A vendor publishes a monthly allowance in whichever unit it meters, and the
  // catalog records both. Reading only the page one priced a plan that takes
  // two documents a month as if it took any number of them.
  const monthly = [
    {
      counts: 'documents' as const,
      allowance: cap(plan, 'documents_per_month'),
      used: input.documents,
      rate: 'document',
    },
    {
      counts: 'pages' as const,
      allowance: cap(plan, 'pages_per_month'),
      used: totalPages,
      rate: 'page',
    },
  ]

  const overage = overagePrice(plan)
  const breached = monthly
    .map((allowance) => ({
      ...allowance,
      excess: allowance.allowance === null ? 0 : Math.max(0, allowance.used - allowance.allowance),
      // A cap sells its way past only at a rate published in the same unit: a
      // per-page overage says nothing about a third document.
      metered: overage && overage.unit === allowance.rate ? overage : null,
    }))
    .filter((allowance) => allowance.excess > 0)

  const unpriced = breached.find((allowance) => !allowance.metered)
  if (unpriced) {
    return {
      kind: 'over-limit',
      max: unpriced.allowance as number,
      counts: unpriced.counts,
      per: 'month',
    }
  }

  const billed = breached[0] ?? null
  const allowance = monthly.find((entry) => entry.allowance !== null)?.allowance ?? null

  if (SUBSCRIPTION.has(base.unit)) {
    // Without an allowance the bill does not move with the volume, and saying
    // so beats printing a fee the reader pays either way.
    if (allowance === null) return { kind: 'included' }

    const total =
      toTenThousandths(base.amount) +
      (billed?.metered ? billed.excess * toTenThousandths(billed.metered.amount) : 0)

    return {
      kind: 'amount',
      total: fromTenThousandths(total),
      perPage: fromTenThousandths(Math.round(total / totalPages)),
      currency: base.currency,
      ...(billed?.metered
        ? {
            overage: {
              base: base.amount,
              over: billed.excess,
              counts: billed.counts,
              rate: billed.metered.amount,
            },
          }
        : {}),
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

/**
 * A plan as the caller identifies it.
 *
 * A plan `code` is unique within its tool and nowhere else - two vendors both
 * publish a `pro` - so once a table holds more than one tool the caller has to
 * say what a row is called, and gets its answer back in those terms.
 */
export type KeyedPlan = { key: string; plan: PlanOut }

/**
 * The rows the catalog has a figure for, and what that figure is.
 *
 * A row is a candidate only if the catalog has a figure for this month's work
 * that it is willing to state:
 *
 * - a costed total, or
 * - a flat monthly fee that covers the work, which is that fee.
 *
 * Everything else is left out rather than guessed at. An annual or per-seat fee
 * is not this month's bill, and turning one into a monthly figure needs a
 * divisor no vendor published - the same division `apps/catalog/pricing.py`
 * refuses. A plan that cannot take the volume has no price at all.
 */
function candidates(rows: KeyedPlan[], input: DocumentInput) {
  const priced: { key: string; total: number; currency: string }[] = []

  for (const row of rows) {
    const cost = documentCost(row.plan, input)
    const base = basePrice(row.plan)

    if (cost.kind === 'amount') {
      priced.push({ key: row.key, total: toTenThousandths(cost.total), currency: cost.currency })
    } else if (cost.kind === 'included' && base && base.unit === 'month') {
      priced.push({
        key: row.key,
        total: toTenThousandths(base.amount),
        currency: base.currency,
      })
    }
  }

  return priced
}

/**
 * The keys of the rows that cost least for `input`, cheapest-first thinking
 * made explicit so the table can point at an answer instead of leaving the
 * reader to scan a column.
 *
 * Mixed currencies return nothing: ranking them needs an exchange rate the
 * catalog does not publish, and picking one anyway would be a number we made
 * up. Across tools that is no longer a hypothetical, which is why
 * `comparableCurrencies` exists to let a caller say so.
 *
 * Returns every row tied at the lowest. A joint-cheapest pair is the true
 * answer, and breaking the tie on row order would invent a winner.
 */
export function cheapestRows(rows: KeyedPlan[], input: DocumentInput): string[] {
  const priced = candidates(rows, input)

  if (!priced.length) return []
  if (new Set(priced.map((candidate) => candidate.currency)).size > 1) return []

  const lowest = Math.min(...priced.map((candidate) => candidate.total))
  return priced.filter((candidate) => candidate.total === lowest).map((candidate) => candidate.key)
}

/**
 * The distinct currencies the priced rows are published in.
 *
 * More than one and there is no ranking to be had, so a table can say that
 * rather than leave an unbadged column reading like a tie.
 */
export function comparableCurrencies(rows: KeyedPlan[], input: DocumentInput): string[] {
  return [...new Set(candidates(rows, input).map((candidate) => candidate.currency))]
}

/** The same, for one tool's plans, where the plan code is the row's name. */
export function cheapestPlan(plans: PlanOut[], input: DocumentInput): string[] {
  return cheapestRows(
    plans.map((plan) => ({ key: plan.code, plan })),
    input,
  )
}
