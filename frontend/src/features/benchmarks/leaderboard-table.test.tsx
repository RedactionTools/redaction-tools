import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { makeRate, makeRow } from './fixtures'
import { LeaderboardTable } from './leaderboard-table'

function render(rows = [makeRow()], caseCount = 4) {
  return renderWithProviders(
    <LeaderboardTable suite="pdf" rows={rows} caseCount={caseCount} revision="v0.1.1" />,
  )
}

describe('LeaderboardTable', () => {
  it('shows the leak rate with its interval and the counts behind it', () => {
    render()

    const row = screen.getByTestId('leaderboard-row-pdf-redaction-web')
    expect(within(row).getByText('22.2%')).toBeInTheDocument()
    expect(within(row).getByText('13.2–34.9%')).toBeInTheDocument()
    expect(within(row).getByText('12 of 54')).toBeInTheDocument()
  })

  it('ranks the rows it is given, numbering from one', () => {
    render([
      makeRow(),
      makeRow({
        tool: { slug: 'adobe-acrobat', name: 'Adobe Acrobat', logo_url: '', listable: true },
        leak_rate: makeRate(30, 54),
      }),
    ])

    const rows = screen.getAllByTestId(/^leaderboard-row-/)
    expect(within(rows[0]).getByText('1')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Adobe Acrobat')).toBeInTheDocument()
  })

  it('links a tool to its report, and names a tool with no public page without a link', () => {
    render([
      makeRow(),
      makeRow({
        tool: { slug: 'hidden-tool', name: 'Hidden Tool', logo_url: '', listable: false },
      }),
    ])

    expect(screen.getByRole('link', { name: 'PDF Redaction' })).toHaveAttribute(
      'href',
      '/benchmarks/pdf/tools/pdf-redaction?revision=v0.1.1',
    )
    expect(screen.getByText('Hidden Tool').closest('a')).toBeNull()
  })

  it('says who published a result and how far it can be trusted', () => {
    render([
      makeRow({
        provenance: 'mismatch',
        submitters: [{ name: 'Tool Owner', role: 'owner' }],
      }),
    ])

    expect(screen.getByText('Disputed by our rescore')).toBeInTheDocument()
    expect(screen.getByText('Tool Owner')).toBeInTheDocument()
    expect(screen.getByText('Tool owner')).toBeInTheDocument()
  })

  it('shows coverage, so a tool tested on one case is not read as tested on all', () => {
    render([makeRow({ cases: 1 })], 4)

    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })

  it('flags a tool that damaged the document', () => {
    render([makeRow({ gates_failed: 2 })])

    expect(screen.getByText('2 cases damaged')).toBeInTheDocument()
  })

  it('says plainly when nothing is published yet', () => {
    render([])

    expect(screen.getByText(/no results published for v0\.1\.1 yet/i)).toBeInTheDocument()
  })
})
