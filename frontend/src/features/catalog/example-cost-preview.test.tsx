import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ExampleCostPreview } from './example-cost-preview'

describe('ExampleCostPreview', () => {
  it('shows the shape of the answer before a tool is chosen', () => {
    render(<ExampleCostPreview input={{ documents: 1, pagesPerDocument: 10 }} />)

    const preview = screen.getByTestId('example-cost-preview')
    expect(within(preview).getByRole('columnheader', { name: 'Plan' })).toBeInTheDocument()
    expect(within(preview).getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
    expect(within(preview).getByRole('columnheader', { name: 'Per page' })).toBeInTheDocument()
  })

  /**
   * The catalog's whole claim is that its figures are published ones. A preview
   * that could be mistaken for a vendor's rates would spend that credibility,
   * so the disclaimer is load-bearing, not decoration.
   */
  it('says plainly that the figures are invented', () => {
    render(<ExampleCostPreview input={{ documents: 1, pagesPerDocument: 10 }} />)

    const preview = screen.getByTestId('example-cost-preview')
    expect(within(preview).getByText(/example/i)).toBeInTheDocument()
    expect(within(preview).getByText(/not.*(vendor|real)/i)).toBeInTheDocument()
  })

  it('prices the example plans off the volume it is given', () => {
    render(<ExampleCostPreview input={{ documents: 1, pagesPerDocument: 10 }} />)

    // Ten pages at the $0.10-per-page example rate.
    const starter = screen.getByTestId('cost-row-example-starter')
    expect(within(starter).getByText('$1.00')).toBeInTheDocument()
    expect(within(starter).getByText('$0.10')).toBeInTheDocument()
  })

  it('reprices when the volume grows, overage and all', () => {
    render(<ExampleCostPreview input={{ documents: 1000, pagesPerDocument: 10 }} />)

    // $49 covers 1,000 pages; the other 9,000 bill at the $0.05 example rate.
    const team = screen.getByTestId('cost-row-example-team')
    expect(within(team).getByText('$499.00')).toBeInTheDocument()
    expect(team).toHaveTextContent('9,000 over')
  })

  // Example or not, the arithmetic must keep the catalog's rule: a flat monthly
  // fee is not a per-document price.
  it('still refuses to divide an unmetered subscription into a volume', () => {
    render(<ExampleCostPreview input={{ documents: 1, pagesPerDocument: 10 }} />)

    const enterprise = screen.getByTestId('cost-row-example-enterprise')
    expect(within(enterprise).getByText('Included in the plan')).toBeInTheDocument()
  })
})
