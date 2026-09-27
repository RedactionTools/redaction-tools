import type { ToolDetailOut } from '@/lib/api/generated/model'
import { comparableCurrencies, type DocumentInput } from '@/lib/catalog/document-cost'

import { ConversionNote, CurrencySelect, useDisplayCurrency } from './display-currency'
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
 *
 * Vendors quote in their own currencies, so the totals are converted into the
 * reader's at the ECB reference rates and ranked there. The published price
 * column stays the vendor's own figure.
 */
export function ToolCostComparison({
  tools,
  input,
}: {
  tools: ToolDetailOut[]
  input: DocumentInput
}) {
  const rows = comparisonRows(tools)
  const display = useDisplayCurrency(rows)
  const currencies = comparableCurrencies(rows, input, display.conversion ?? undefined)

  return (
    <section className="space-y-4" data-testid="tool-cost-comparison">
      <h2 className="text-xl font-semibold">What will it cost?</h2>

      <CurrencySelect
        id="comparison-currency"
        value={display.currency}
        options={display.options}
        onChange={display.setCurrency}
      />

      <CostTable
        rows={rows}
        input={input}
        caption={COST_CAPTION}
        showTool={tools.length > 1}
        conversion={display.conversion}
      />

      {display.converts && display.asOf ? <ConversionNote asOf={display.asOf} /> : null}

      {/* The ranking goes quiet when a currency cannot be converted - no rates
          yet, or one the ECB does not quote - and silence reads as a tie. */}
      {currencies.length > 1 ? (
        <p className="text-muted-foreground text-sm text-pretty" data-testid="mixed-currencies">
          These plans are published in {currencies.join(' and ')}, and there is no exchange rate to
          convert between them, so the table will not say which is cheapest.
        </p>
      ) : null}
    </section>
  )
}
