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
    expect(within(row).getByRole('presentation')).toHaveAttribute(
      'src',
      '/images/tools/adobe-acrobat.svg',
    )
  })

  it('falls back to a monogram for a tool with no logo', () => {
    render([makeTool({ slug: 'acme', name: 'Acme Redact', logo_url: '' })])

    const row = screen.getByTestId('tool-row-acme')
    expect(within(row).getByTestId('tool-monogram')).toHaveTextContent('AR')
  })
})
