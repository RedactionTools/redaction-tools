import type { ToolDetailOut } from '@/lib/api/generated/model'
import { comparableCurrencies, type DocumentInput } from '@/lib/catalog/document-cost'

import { COST_CAPTION, CostTable, type CostRow } from './document-cost-calculator'

/** Every selected tool's plans, each row named for the tool it belongs to. */
function comparisonRows(tools: ToolDetailOut[]): CostRow[] {
  return tools.flatMap((tool) =>
    tool.plans.map((plan) => ({ key: `${tool.slug}-${plan.code}`, plan, tool })),
  )
}

/**
 * Every selected tool's plans in one table, ranked against each other.
 *
 * One table rather than one per tool, because the question a reader brings here
 * is which of them is cheapest for their month - and a badge that only ever
 * won within its own tool answers a question nobody asked.
 */
export function ToolCostComparison({
  tools,
  input,
}: {
  tools: ToolDetailOut[]
  input: DocumentInput
}) {
  const rows = comparisonRows(tools)
  const currencies = comparableCurrencies(rows, input)

  return (
    <section className="space-y-4" data-testid="tool-cost-comparison">
      <h2 className="text-xl font-semibold">What will it cost?</h2>

      <CostTable rows={rows} input={input} caption={COST_CAPTION} showTool={tools.length > 1} />

      {/* The ranking goes quiet across currencies, and silence reads as a tie.
          Saying so is the same refusal `apps/catalog/pricing.py` makes: the
          catalog publishes no exchange rate, so it has no cheapest to name. */}
      {currencies.length > 1 ? (
        <p className="text-muted-foreground text-sm text-pretty" data-testid="mixed-currencies">
          These plans are published in {currencies.join(' and ')}. The catalog publishes no exchange
          rate, so it will not say which is cheapest — converting them would be a figure no vendor
          quoted.
        </p>
      ) : null}
    </section>
  )
}
