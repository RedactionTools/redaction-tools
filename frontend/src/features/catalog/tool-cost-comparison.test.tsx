import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
    render(<ToolCostComparison tools={[ACROBAT, REDACTABLE]} input={VOLUME} />)

    expect(screen.getByTestId('cost-row-adobe-acrobat-pro')).toBeInTheDocument()
    expect(screen.getByTestId('cost-row-redactable-pro')).toBeInTheDocument()
  })

  it('says whose plan each row is', () => {
    render(<ToolCostComparison tools={[ACROBAT, REDACTABLE]} input={VOLUME} />)

    expect(screen.getByRole('columnheader', { name: 'Tool' })).toBeInTheDocument()
    expect(
      within(screen.getByTestId('cost-row-redactable-pro')).getByText('Redactable'),
    ).toBeInTheDocument()
  })

  // With one tool the column would repeat the name the picker above already
  // carries, on every row.
  it('leaves the column out when there is nothing to tell apart', () => {
    render(<ToolCostComparison tools={[ACROBAT]} input={VOLUME} />)

    expect(screen.queryByRole('columnheader', { name: 'Tool' })).not.toBeInTheDocument()
  })

  // The whole point of the merged table: one winner, across vendors.
  it('badges the cheapest row across every tool, not within each', () => {
    render(<ToolCostComparison tools={[ACROBAT, REDACTABLE]} input={VOLUME} />)

    // 100 pages at $0.05 is $5.00, against Acrobat's $22.99 a month.
    expect(
      within(screen.getByTestId('cost-row-redactable-pro')).getByText(/cheapest for this volume/i),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/cheapest for this volume/i)).toHaveLength(1)
  })

  // Within one tool a second currency is a rarity; across vendors it is
  // ordinary. The ranking goes quiet either way, and an unbadged table reads as
  // a tie unless it says why.
  it('says why it named no winner when the tools price in different currencies', () => {
    const euros = makeToolDetail({
      slug: 'docugard',
      name: 'Docugard',
      plans: [
        makePlan({
          code: 'pro',
          prices: [makePrice({ amount: '0.0100', currency: 'EUR', unit: 'page' })],
        }),
      ],
    })

    render(<ToolCostComparison tools={[REDACTABLE, euros]} input={VOLUME} />)

    expect(screen.queryByText(/cheapest for this volume/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('mixed-currencies')).toHaveTextContent(/EUR/)
  })
})
