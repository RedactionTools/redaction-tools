import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getListToolsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { CatalogFilters } from '@/lib/catalog/filters'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { makePage, makeTool } from './fixtures'
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

  it('shows the vendor and the entry price', () => {
    render()

    const row = screen.getByTestId('tool-row-adobe-acrobat')
    expect(within(row).getByText('Adobe')).toBeInTheDocument()
    expect(within(row).getByText('From $22.99 per month')).toBeInTheDocument()
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
    expect(cells[2]).toHaveAttribute('data-label', 'From')
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
