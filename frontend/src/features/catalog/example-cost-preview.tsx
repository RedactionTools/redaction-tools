import type { PlanOut, PriceOut } from '@/lib/api/generated/model'
import type { DocumentInput } from '@/lib/catalog/document-cost'

import { CostTable } from './document-cost-calculator'

function examplePrice(overrides: Partial<PriceOut>): PriceOut {
  return {
    amount: '0.0000',
    currency: 'USD',
    unit: 'page',
    billing_period: 'usage',
    is_overage: false,
    // Nothing here is sourced, because nothing here was published. The table
    // only badges provenance when it is handed a real tool, so these never
    // carry the "verified" mark that a catalog figure earns.
    source: 'example',
    is_pinned: false,
    source_note: '',
    source_evidence_url: '',
    effective_from: '',
    ...overrides,
  }
}

function examplePlan(overrides: Partial<PlanOut>): PlanOut {
  return {
    code: 'example',
    name: 'Example',
    tier_order: 0,
    is_free_tier: false,
    is_trial: false,
    trial_days: null,
    is_enterprise_quote: false,
    min_seats: 1,
    highlights: [],
    source_url: '',
    verified_at: null,
    prices: [],
    limits: [],
    ...overrides,
  }
}

/**
 * Three invented plans, one per shape of answer the table can give: a rate that
 * scales with the work, a fee that meters once its allowance runs out, and a
 * subscription that simply covers the job.
 *
 * Round numbers on purpose. A plausible-looking $22.99 would read as somebody's
 * real price; $0.10 and $49 read as arithmetic.
 */
const EXAMPLE_PLANS: PlanOut[] = [
  examplePlan({
    code: 'example-starter',
    name: 'Starter',
    tier_order: 1,
    prices: [examplePrice({ amount: '0.1000', unit: 'page' })],
  }),
  examplePlan({
    code: 'example-team',
    name: 'Team',
    tier_order: 2,
    prices: [
      examplePrice({ amount: '49.0000', unit: 'month', billing_period: 'monthly' }),
      examplePrice({ amount: '0.0500', unit: 'page', is_overage: true }),
    ],
    limits: [
      {
        kind: 'pages_per_month',
        label: 'Pages a month',
        value: 1000,
        unit: 'page',
        is_unlimited: false,
        note: '',
        display: '1,000 pages a month',
      },
    ],
  }),
  examplePlan({
    code: 'example-enterprise',
    name: 'Enterprise',
    tier_order: 3,
    prices: [examplePrice({ amount: '499.0000', unit: 'month', billing_period: 'monthly' })],
  }),
]

/**
 * What the calculator answers with, before it has been asked about a tool.
 *
 * An empty page teaches nothing: the reader cannot tell whether choosing a tool
 * is worth the click. So the volume fields drive a worked example instead, and
 * the three plans between them show every outcome a real tool can produce.
 *
 * The figures are invented, and the copy says so twice - a catalog that trades
 * on published prices cannot afford a table that reads like one.
 */
export function ExampleCostPreview({ input }: { input: DocumentInput }) {
  return (
    <section className="space-y-4" data-testid="example-cost-preview">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">What will it cost?</h2>
        <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
          Example
        </span>
      </div>

      <p className="text-muted-foreground text-sm text-pretty">
        These plans are invented and so are their rates — they are not any vendor&apos;s prices.
        Choose a tool above and this same table fills with that tool&apos;s published figures.
      </p>

      {/* Dimmed, so the preview never competes with the real thing beside it in
          a screenshot. */}
      <div className="opacity-70">
        <CostTable
          plans={EXAMPLE_PLANS}
          input={input}
          caption="An illustration, worked with the real arithmetic: Starter bills every page, Team meters once its 1,000-page allowance runs out, and Enterprise covers the job for a flat fee — which is why it quotes no per-page figure."
        />
      </div>
    </section>
  )
}
