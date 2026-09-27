import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { getListExchangeRatesQueryKey } from '@/lib/api/generated/catalog/catalog'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { makePlan, makePrice, makeToolDetail } from './fixtures'
import { ToolCostComparison } from './tool-cost-comparison'

const VOLUME = { documents: 10, pagesPerDocument: 10 }

const ACROBAT = makeToolDetail({
  slug: 'adobe-acrobat',
  name: 'Adobe Acrobat',
  plans: [
    makePlan({
      code: 'pro',
      name: 'Acrobat Pro',
      prices: [makePrice({ amount: '22.9900' })],
    }),
  ],
})

// 100 pages at €0.01 is €1.00, which is $1.085 at the rates below.
const DOCUGARD = makeToolDetail({
  slug: 'docugard',
  name: 'Docugard',
  plans: [
    makePlan({
      code: 'pro',
      prices: [makePrice({ amount: '0.0100', currency: 'EUR', unit: 'page' })],
    }),
  ],
})

function withRates() {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(getListExchangeRatesQueryKey(), {
    base: 'EUR',
    as_of: '2026-09-25',
    rates: { EUR: '1.0000', USD: '1.0850' },
  })
  return { queryClient }
}

const REDACTABLE = makeToolDetail({
  slug: 'redactable',
  name: 'Redactable',
  plans: [
    makePlan({
      code: 'pro',
      name: 'Redactable Pro',
      prices: [makePrice({ amount: '0.0500', unit: 'page', billing_period: 'usage' })],
    }),
  ],
})

describe('ToolCostComparison', () => {
  // Two vendors both publish a `pro`, so the row keys have to carry the tool or
  // one plan quietly replaces the other.
  it('costs every plan of every tool in one table', () => {
    renderWithProviders(<ToolCostComparison tools={[ACROBAT, REDACTABLE]} input={VOLUME} />)

    expect(screen.getByTestId('cost-row-adobe-acrobat-pro')).toBeInTheDocument()
    expect(screen.getByTestId('cost-row-redactable-pro')).toBeInTheDocument()
  })

  it('says whose plan each row is', () => {
    renderWithProviders(<ToolCostComparison tools={[ACROBAT, REDACTABLE]} input={VOLUME} />)

    expect(screen.getByRole('columnheader', { name: 'Tool' })).toBeInTheDocument()
    expect(
      within(screen.getByTestId('cost-row-redactable-pro')).getByText('Redactable'),
    ).toBeInTheDocument()
  })

  // With one tool the column would repeat the name the picker above already
  // carries, on every row.
  it('leaves the column out when there is nothing to tell apart', () => {
    renderWithProviders(<ToolCostComparison tools={[ACROBAT]} input={VOLUME} />)

    expect(screen.queryByRole('columnheader', { name: 'Tool' })).not.toBeInTheDocument()
  })

  // The whole point of the merged table: one winner, across vendors.
  it('badges the cheapest row across every tool, not within each', () => {
    renderWithProviders(<ToolCostComparison tools={[ACROBAT, REDACTABLE]} input={VOLUME} />)

    // 100 pages at $0.05 is $5.00, against Acrobat's $22.99 a month.
    expect(
      within(screen.getByTestId('cost-row-redactable-pro')).getByText(/cheapest for this volume/i),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/cheapest for this volume/i)).toHaveLength(1)
  })

  // Within one tool a second currency is a rarity; across vendors it is
  // ordinary. Without rates the ranking goes quiet, and an unbadged table reads
  // as a tie unless it says why.
  it('says why it named no winner when there are no rates to convert with', () => {
    renderWithProviders(<ToolCostComparison tools={[REDACTABLE, DOCUGARD]} input={VOLUME} />)

    expect(screen.queryByText(/cheapest for this volume/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('mixed-currencies')).toHaveTextContent(/EUR/)
  })

  describe('with exchange rates', () => {
    it('ranks across currencies once totals are converted', () => {
      renderWithProviders(
        <ToolCostComparison tools={[REDACTABLE, DOCUGARD]} input={VOLUME} />,
        withRates(),
      )

      const euros = screen.getByTestId('cost-row-docugard-pro')
      expect(within(euros).getByText(/cheapest for this volume/i)).toBeInTheDocument()
      expect(screen.queryByTestId('mixed-currencies')).not.toBeInTheDocument()
    })

    // Converted, marked as such, and the vendor's own figure kept beside it.
    it('shows a converted total next to the published one', () => {
      renderWithProviders(
        <ToolCostComparison tools={[REDACTABLE, DOCUGARD]} input={VOLUME} />,
        withRates(),
      )

      const euros = screen.getByTestId('cost-row-docugard-pro')
      expect(within(euros).getByText('≈ $1.09')).toBeInTheDocument()
      expect(within(euros).getByText('€1.00')).toBeInTheDocument()
      expect(screen.getByText(/ECB reference rates of 25 September 2026/)).toBeInTheDocument()
    })

    it('converts into the currency the reader picks', async () => {
      renderWithProviders(
        <ToolCostComparison tools={[REDACTABLE, DOCUGARD]} input={VOLUME} />,
        withRates(),
      )

      await userEvent.selectOptions(screen.getByLabelText(/show prices in/i), 'EUR')

      // $5.00 is €4.6083.
      const dollars = screen.getByTestId('cost-row-redactable-pro')
      expect(within(dollars).getByText('≈ €4.61')).toBeInTheDocument()
      expect(within(screen.getByTestId('cost-row-docugard-pro')).queryByText(/≈/)).toBeNull()
    })
  })
})
