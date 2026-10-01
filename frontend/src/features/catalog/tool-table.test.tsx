import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { getListToolsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { CatalogFilters } from '@/lib/catalog/filters'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { makePage, makePlan, makePrice, makeTool } from './fixtures'
import { ToolTable } from './tool-table'

function render(tools = [makeTool()], filters: CatalogFilters = {}) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getListToolsQueryKey(filters), makePage(tools))
  return renderWithProviders(<ToolTable filters={filters} />, { queryClient })
}

describe('ToolTable', () => {
  it('names the table, so the data is readable out of context', () => {
    render()

    expect(screen.getByRole('table')).toHaveAccessibleName(/redaction tools/i)
  })

  it('links each tool to its canonical page', () => {
    render()

    expect(screen.getByRole('link', { name: /adobe acrobat/i })).toHaveAttribute(
      'href',
      '/tool/adobe-acrobat',
    )
  })

  // The hub follows the editors' order, not price: a caption claiming otherwise
  // tells a reader the first row is the cheapest when it may not be.
  it('makes no claim about the order in its caption', () => {
    render()

    const caption = document.querySelector('caption')
    expect(caption).toHaveTextContent('redaction tools, with prices as last verified.')
    expect(caption).not.toHaveTextContent(/sorted/i)
  })

  it('shows the vendor and the entry price', () => {
    render()

    const row = screen.getByTestId('tool-row-adobe-acrobat')
    expect(within(row).getByText('Adobe')).toBeInTheDocument()
    expect(within(row).getByText('From $22.99 per month')).toBeInTheDocument()
  })

  // A "from" price answers what the cheapest plan costs, not what the reader's
  // month would - a per-page rate and a flat fee cannot be ranked by it.
  it('shows what 1,000 pages a month cost on the cheapest plan', () => {
    render([
      makeTool({
        plans: [
          makePlan({
            code: 'payg',
            name: 'Pay as you go',
            prices: [makePrice({ amount: '0.0500', unit: 'page', billing_period: 'usage' })],
          }),
          makePlan({ code: 'pro', name: 'Pro', prices: [makePrice({ amount: '15.0000' })] }),
        ],
      }),
    ])

    const cell = within(screen.getByTestId('tool-row-adobe-acrobat')).getByTestId(
      'volume-cost-adobe-acrobat',
    )
    expect(cell).toHaveTextContent('$15.00')
    expect(cell).toHaveTextContent('Pro')
  })

  // An annual fee, a quote or no plan at all: no figure we would stand behind.
  it('shows a dash when no plan can be costed at that volume', () => {
    render([makeTool({ plans: [] })])

    expect(screen.getByTestId('volume-cost-adobe-acrobat')).toHaveTextContent('—')
  })

  // Icons keep a column that can hold several methods narrow; each still has
  // a name, since an icon alone means nothing to a screen reader.
  it('shows each redaction method as a named icon', () => {
    render([makeTool({ facet_slugs: ['pdf', 'manual-redaction', 'ai'] })])

    const cell = screen.getByTestId('methods-adobe-acrobat')
    expect(within(cell).getByRole('img', { name: 'Manual' })).toBeInTheDocument()
    expect(within(cell).getByRole('img', { name: 'AI-powered' })).toBeInTheDocument()
    expect(within(cell).queryByRole('img', { name: 'Rule-based' })).not.toBeInTheDocument()
  })

  // A touch screen has no hover, so the icons are named once below the table.
  it('keys every method icon in a legend', () => {
    render()

    const legend = screen.getByTestId('method-legend')
    for (const label of ['Manual', 'AI-powered', 'Hybrid', 'Rule-based']) {
      expect(within(legend).getByText(label)).toBeInTheDocument()
    }
  })

  // "1,000 pages" alone leaves the reader to guess how they are split, and the
  // split matters: a per-document rate is charged 100 times, not 1,000.
  it('says on hover how the 1,000 pages are made up', async () => {
    const user = userEvent.setup()
    render()

    await user.hover(screen.getByRole('button', { name: /1,000 pages/ }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '100 documents × 10 pages, every month',
    )
  })

  // The column is our arithmetic, not a published price, so it says how it
  // was done and where to price a different month.
  it('explains the 1,000-pages column and points to the calculator', () => {
    render()

    expect(screen.getByRole('columnheader', { name: /1,000 pages/ })).toHaveAccessibleDescription(
      /100 documents of 10 pages/,
    )
    expect(
      within(screen.getByTestId('volume-cost-note')).getByRole('link', { name: /calculator/i }),
    ).toHaveAttribute('href', '/price-calculator')
  })

  it('reports a trial as a trial rather than as a free tier', () => {
    render()

    const row = screen.getByTestId('tool-row-adobe-acrobat')
    expect(within(row).getByText('7-day trial')).toBeInTheDocument()
    expect(within(row).queryByText('Free')).not.toBeInTheDocument()
  })

  it('says where every price came from', () => {
    render()

    const row = screen.getByTestId('tool-row-adobe-acrobat')
    expect(within(row).getByTestId('provenance-adobe-acrobat')).toHaveAccessibleName(
      /entered by our editors/i,
    )
  })

  it('marks a tool its vendor maintains here', () => {
    render([
      makeTool({ slug: 'caseguard', name: 'CaseGuard', is_vendor_maintained: true }),
      makeTool(),
    ])

    const maintained = screen.getByTestId('tool-row-caseguard')
    expect(within(maintained).getByText('Vendor-maintained')).toBeInTheDocument()
    const other = screen.getByTestId('tool-row-adobe-acrobat')
    expect(within(other).queryByText('Vendor-maintained')).not.toBeInTheDocument()
  })

  it('does not clutter the table with the first-party note', () => {
    // Disclosure lives on the profile and the methodology page; repeating it in
    // every row costs a column's worth of attention for no extra information.
    render([makeTool({ slug: 'pdf-redaction', name: 'PDF Redaction', is_first_party: true })])

    const row = screen.getByTestId('tool-row-pdf-redaction')
    expect(within(row).queryByText(/our own product/i)).not.toBeInTheDocument()
  })

  it('says so when a filter matches nothing, rather than rendering an empty table', () => {
    render([])

    expect(screen.getByText(/no tools match/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it("shows each tool's logo beside its name", () => {
    render()

    const row = screen.getByTestId('tool-row-adobe-acrobat')
    // Queried as an element, not by role: the logo is `aria-hidden`, because
    // the tool's name is right beside it in the same cell.
    expect(row.querySelector('img')).toHaveAttribute('src', '/images/tools/adobe-acrobat.svg')
  })

  it('falls back to a monogram for a tool with no logo', () => {
    render([makeTool({ slug: 'acme', name: 'Acme Redact', logo_url: '' })])

    const row = screen.getByTestId('tool-row-acme')
    expect(within(row).getByTestId('tool-monogram')).toHaveTextContent('AR')
  })

  /**
   * Below `md` the header row is gone and every row is a card, so the field
   * name has to travel with the value. It is generated content rather than a
   * node on purpose: a real <span> would land in `textContent` and change what
   * every other cell assertion in the suite reads back.
   */
  it('names each field on the row, where there is no header to read up to', () => {
    render()

    const cells = within(screen.getByTestId('tool-row-adobe-acrobat')).getAllByRole('cell')
    expect(cells[1]).toHaveAttribute('data-label', 'Media')
    expect(cells[2]).toHaveAttribute('data-label', 'Method')
    expect(cells[3]).toHaveAttribute('data-label', 'From')
    expect(cells[4]).toHaveAttribute('data-label', '1,000 pages')
  })

  /**
   * The first cell is the card's heading - labelling it would read as
   * "Tool ---- Adobe Acrobat" above the name it already shows.
   */
  it('leaves the heading cell unlabelled', () => {
    render()

    const cells = within(screen.getByTestId('tool-row-adobe-acrobat')).getAllByRole('cell')
    expect(cells[0]).not.toHaveAttribute('data-label')
  })

  /**
   * Changing `display` on a table strips its semantics in every browser
   * engine, so the roles are spelled out rather than left implicit. jsdom
   * applies no CSS, which makes the attribute the only testable proxy for
   * something that would otherwise break only in a real browser.
   */
  it('stays a table once CSS stops it looking like one', () => {
    render()

    expect(screen.getByRole('table')).toHaveAttribute('role', 'table')

    const cells = within(screen.getByTestId('tool-row-adobe-acrobat')).getAllByRole('cell')
    expect(cells[0]).toHaveAttribute('role', 'cell')
  })
})
