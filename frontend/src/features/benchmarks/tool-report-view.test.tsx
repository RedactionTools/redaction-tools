import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { getGetBenchmarkToolReportQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import type { ToolReportOut } from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { makeRun, makeToolReport } from './fixtures'
import { ToolReportView } from './tool-report-view'

const params = { revision: 'v0.1.1', scope: 'all' as const }

function render(report: ToolReportOut = makeToolReport()) {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(
    getGetBenchmarkToolReportQueryKey('pdf', 'pdf-redaction', params),
    report,
  )
  return renderWithProviders(<ToolReportView suite="pdf" slug="pdf-redaction" params={params} />, {
    queryClient,
  })
}

describe('ToolReportView', () => {
  it('leads with the pooled verdict, its interval and its sample size', () => {
    render()

    const hero = screen.getByTestId('report-hero-web')
    expect(within(hero).getByText('22.2%')).toBeInTheDocument()
    expect(within(hero).getByText(/13\.2–34\.9%/)).toBeInTheDocument()
    expect(within(hero).getByText('Leaked 12 of 54 sensitive values (22.2%).')).toBeInTheDocument()
    expect(within(hero).getByText(/1 of 4 cases/)).toBeInTheDocument()
  })

  it('says where the leaks are, and what surviving in each place means', () => {
    render()

    const layers = screen.getByTestId('breakdown-layers')
    expect(within(layers).getByText('rendered_pixels')).toBeInTheDocument()
    expect(within(layers).getByText('visible to anyone who opens the file')).toBeInTheDocument()
  })

  it('lists what could not be measured rather than scoring it as clean', () => {
    render()

    const gaps = screen.getByTestId('not-measured')
    expect(within(gaps).getByText(/ocr/)).toBeInTheDocument()
  })

  it('flags each survivability gate a run failed', () => {
    render()

    expect(screen.getByText(/not_rasterised failed in 1 of 1/)).toBeInTheDocument()
  })

  it('enlarges an overlay on request', async () => {
    render()

    await userEvent.click(
      screen.getByRole('button', { name: /enlarge the overlay for extraction-conditions-1/i }),
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('links each case to its full run report and its redacted PDF', () => {
    render()

    const run = makeRun()
    expect(screen.getByRole('link', { name: /full report/i })).toHaveAttribute(
      'href',
      `/benchmarks/pdf/runs/${run.run_id}`,
    )
    expect(screen.getByRole('link', { name: /redacted pdf/i })).toHaveAttribute(
      'href',
      run.output_pdf_url,
    )
  })

  it('shows a holdout case as scored, with nothing to open', () => {
    const report = makeToolReport()
    report.surfaces[0].runs = [
      makeRun({ holdout: true, case_id: '', run_id: '', overlay: null, output_pdf_url: null }),
    ]
    render(report)

    expect(screen.getByText('Holdout case')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /full report/i })).toBeNull()
  })

  it('names who published the runs', () => {
    render()

    expect(screen.getByText('Tool Owner')).toBeInTheDocument()
    expect(screen.getAllByText('Self-scored · verified').length).toBeGreaterThan(0)
  })
})
