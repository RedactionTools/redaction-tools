import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { ToolDetailOut } from '@/lib/api/generated/model'
import { renderWithProviders } from '@/test/render'

import { DocumentCostCalculator } from './document-cost-calculator'
import { makePlan, makePrice, makeToolDetail } from './fixtures'

function tool(): ToolDetailOut {
  return makeToolDetail({
    plans: [
      makePlan({
        code: 'free',
        name: 'Free',
        is_free_tier: true,
        prices: [makePrice({ amount: '0.0000' })],
        limits: [
          {
            kind: 'pages_per_document',
            label: 'Pages per document',
            value: 25,
            unit: 'pages',
            is_unlimited: false,
            note: '',
            display: '25 pages',
          },
          {
            kind: 'pages_per_month',
            label: 'Pages per month',
            value: 100,
            unit: 'pages',
            is_unlimited: false,
            note: '',
            display: '100 pages',
          },
        ],
      }),
      makePlan({ code: 'pro', name: 'Pro' }),
      makePlan({
        code: 'payg',
        name: 'Pay as you go',
        prices: [makePrice({ amount: '0.0500', unit: 'page', billing_period: 'usage' })],
      }),
      makePlan({
        code: 'perdoc',
        name: 'Pay per document',
        prices: [makePrice({ amount: '1.0000', unit: 'document', billing_period: 'usage' })],
      }),
    ],
  })
}

function render() {
  return renderWithProviders(<DocumentCostCalculator tool={tool()} />)
}

const row = (code: string) => within(screen.getByTestId(`cost-row-${code}`))

async function setField(label: RegExp, value: string) {
  const user = userEvent.setup()
  const field = screen.getByLabelText(label)
  await user.clear(field)
  await user.type(field, value)
}

describe('DocumentCostCalculator', () => {
  it('prices ten ten-page documents on the per-page plan by default', () => {
    render()

    // The default month: 10 documents x 10 pages at $0.05 a page.
    expect(row('payg').getByText('$5.00')).toBeInTheDocument()
    expect(row('payg').getByText('$0.05')).toBeInTheDocument()
  })

  it('recalculates when the page count changes', async () => {
    render()

    await setField(/pages per document/i, '100')

    expect(row('payg').getByText('$50.00')).toBeInTheDocument()
  })

  it('multiplies by the number of documents', async () => {
    render()

    await setField(/documents a month/i, '5')

    expect(row('payg').getByText('$2.50')).toBeInTheDocument()
  })

  it('sets the page count from a preset', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: '100 pages' }))

    expect(screen.getByLabelText(/pages per document/i)).toHaveValue(100)
    expect(row('payg').getByText('$50.00')).toBeInTheDocument()
  })

  it('never turns a subscription into a per-document price', async () => {
    render()

    // The published $15 per month stays in its own column; what must never
    // appear is a computed figure derived from it.
    const computed = () => row('pro').getAllByRole('cell').slice(2)

    expect(computed().map((cell) => cell.textContent)).toEqual(['Included in the plan'])

    await setField(/pages per document/i, '100')

    expect(computed().map((cell) => cell.textContent)).toEqual(['Included in the plan'])
  })

  it('holds a per-document total flat while its per-page rate falls', async () => {
    render()

    expect(row('perdoc').getByText('$10.00')).toBeInTheDocument()
    expect(row('perdoc').getByText('$0.10')).toBeInTheDocument()

    await setField(/pages per document/i, '100')

    expect(row('perdoc').getByText('$10.00')).toBeInTheDocument()
    expect(row('perdoc').getByText('$0.01')).toBeInTheDocument()
  })

  it('shows the published rate beside the figure derived from it', () => {
    render()

    expect(row('payg').getByText('$0.05 per page')).toBeInTheDocument()
    expect(row('perdoc').getByText('$1 per document')).toBeInTheDocument()
  })

  it('covers a job that fits inside the free allowance', () => {
    render()

    // A metered plan carries its fee rather than "included", because its bill
    // does move with the volume - it just costs nothing at this one.
    expect(
      row('free')
        .getAllByRole('cell')
        .slice(2)
        .map((cell) => cell.textContent),
    ).toEqual(['$0.00', '$0.00'])
  })

  it('says when the free allowance will not stretch, rather than quoting free', async () => {
    render()

    await setField(/documents a month/i, '11')

    expect(row('free').getByText(/over this plan's 100 pages a month/i)).toBeInTheDocument()
    expect(row('free').queryByText(/included in the plan/i)).not.toBeInTheDocument()

    // The paid plans still answer for the same volume.
    expect(row('payg').getByText('$5.50')).toBeInTheDocument()
  })

  it('names the document-length cap when a single document is too long', async () => {
    render()

    await setField(/pages per document/i, '100')

    // 100 pages is under the monthly allowance but over what one document may
    // hold, so the message has to be the one the reader can act on.
    expect(row('free').getByText(/over this plan's 25-page document limit/i)).toBeInTheDocument()
  })

  it('sets the monthly document count from a preset', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: '100 documents' }))

    expect(screen.getByLabelText(/documents a month/i)).toHaveValue(100)
    // 100 ten-page documents at $0.05 a page.
    expect(row('payg').getByText('$50.00')).toBeInTheDocument()
  })

  it('offers the volumes buyers actually arrive with', () => {
    render()

    for (const name of ['10 documents', '100 documents', '1,000 documents']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('keeps a custom volume the presets do not cover', async () => {
    render()

    await setField(/documents a month/i, '37')

    expect(screen.getByLabelText(/documents a month/i)).toHaveValue(37)
    // 37 documents x 10 pages x $0.05.
    expect(row('payg').getByText('$18.50')).toBeInTheDocument()
    // and no preset claims to be the current choice
    for (const name of ['10 documents', '100 documents', '1,000 documents']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('marks the preset that matches the current volume', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: '1,000 documents' }))

    expect(screen.getByRole('button', { name: '1,000 documents' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '100 documents' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('DocumentCostCalculator, the cheapest plan', () => {
  it('marks the cheapest row for the volume asked about', () => {
    render()

    // The default month is 100 pages: free covers it, at nothing.
    expect(row('free').getByText(/cheapest/i)).toBeInTheDocument()
    expect(screen.getByTestId('cost-row-free')).toHaveAttribute('data-cheapest', 'true')
  })

  it('moves the mark as the volume grows past a plan', async () => {
    render()

    // 100 documents of 10 pages: free is over its 100-page monthly allowance,
    // pay-as-you-go is $50, pay-per-document is $100, and Pro's flat $15
    // covers the lot - so the flat fee that read "Included" now wins.
    await setField(/documents a month/i, '100')

    expect(row('pro').getByText(/cheapest/i)).toBeInTheDocument()
    expect(screen.getAllByText(/cheapest/i)).toHaveLength(1)
  })

  it('says cheapest rather than best, and not with colour alone', () => {
    render()

    // A screen reader has to get the same answer the eye does.
    const mark = row('free').getByText(/cheapest/i)
    expect(mark).toHaveTextContent(/cheapest for this volume/i)
  })

  it('tints the whole row, in a colour the theme actually defines', () => {
    render()

    // Tailwind v4 generates utilities only for tokens in the @theme block and
    // drops the rest without a word, so `bg-brand-500` would typecheck, lint,
    // pass a text assertion and render nothing. Pinning the class to a token
    // in globals.css is what makes "highlighted" mean highlighted.
    expect(screen.getByTestId('cost-row-free')).toHaveClass('bg-ok-subtle')
    expect(screen.getByTestId('cost-row-payg')).not.toHaveClass('bg-ok-subtle')
  })
})

describe('DocumentCostCalculator, the volume it is pricing', () => {
  it('states the total pages the two fields multiply out to', () => {
    render()

    // The figure every row is computed from. Leaving the reader to do
    // 10 x 10 in their head is how a misread field goes unnoticed.
    expect(screen.getByTestId('volume-total')).toHaveTextContent('100 pages a month')
  })

  it('follows the fields', async () => {
    render()

    await setField(/documents a month/i, '250')

    expect(screen.getByTestId('volume-total')).toHaveTextContent('2,500 pages a month')
  })

  it('counts a half-typed field the way the table prices it', async () => {
    render()

    // An empty field prices as one rather than as nothing, so the readout has
    // to say one too - otherwise it contradicts the totals beside it.
    await userEvent.setup().clear(screen.getByLabelText(/pages per document/i))

    expect(screen.getByTestId('volume-total')).toHaveTextContent('10 pages a month')
  })

  it('says page, not pages, when there is one', async () => {
    render()

    await setField(/documents a month/i, '1')
    await setField(/pages per document/i, '1')

    expect(screen.getByTestId('volume-total')).toHaveTextContent('1 page a month')
  })
})
