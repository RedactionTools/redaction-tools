import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  getGetBenchmarkCaseQueryKey,
  getGetBenchmarkRunQueryKey,
} from '@/lib/api/generated/benchmarks/benchmarks'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { CaseView } from './case-view'
import { makeCaseDetail, makeRun, makeRunDetail } from './fixtures'
import { RunReportView } from './run-report-view'

const RUN_ID = makeRun().run_id

function renderRun(run = makeRunDetail()) {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(getGetBenchmarkRunQueryKey(RUN_ID), run)
  return renderWithProviders(<RunReportView suite="pdf" runId={RUN_ID} />, { queryClient })
}

describe('RunReportView', () => {
  it('leads with the run and who published it', () => {
    renderRun()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'PDF Redaction on extraction-conditions-1',
    )
    expect(screen.getByText('Leaked 12 of 54 sensitive values (22.2%).')).toBeInTheDocument()
    expect(screen.getByText('Tool Owner')).toBeInTheDocument()
  })

  it('shows its provenance: scorer, engines, alignment and the scorer notes', () => {
    renderRun()

    const provenance = screen.getByTestId('run-provenance')
    expect(within(provenance).getByText('pdfredeval 0.1.1')).toBeInTheDocument()
    expect(within(provenance).getByText(/tesseract 5\.5\.2/)).toBeInTheDocument()
    expect(within(provenance).getByText(/fiducial/)).toBeInTheDocument()
    expect(within(provenance).getByText(/OCR disabled/)).toBeInTheDocument()
  })

  it('puts our rescore beside a claim it did not reproduce', () => {
    renderRun(
      makeRunDetail({
        provenance: 'mismatch',
        verification: 'mismatch',
        verification_diff: { 'counts.FN': { claimed: 0, ours: 12 } },
      }),
    )

    const diff = screen.getByTestId('verification-diff')
    expect(within(diff).getByText('counts.FN')).toBeInTheDocument()
    expect(within(diff).getByText('0')).toBeInTheDocument()
    expect(within(diff).getByText('12')).toBeInTheDocument()
  })
})

describe('CaseView', () => {
  const params = { revision: 'v0.1.1' }

  function renderCase(detail = makeCaseDetail()) {
    const queryClient = makeTestQueryClient()
    queryClient.setQueryData(
      getGetBenchmarkCaseQueryKey('pdf', 'extraction-conditions-1', params),
      detail,
    )
    return renderWithProviders(
      <CaseView suite="pdf" caseId="extraction-conditions-1" params={params} />,
      { queryClient },
    )
  }

  it('offers the case PDF and says what is in it, without the values', () => {
    renderCase()

    expect(screen.getByRole('link', { name: /download the case pdf/i })).toHaveAttribute(
      'href',
      expect.stringContaining('extraction-conditions-1.pdf'),
    )
    expect(screen.getByText('text_layer')).toBeInTheDocument()
    expect(screen.getByText('PERSON')).toBeInTheDocument()
  })

  it('previews the page, and enlarges it to read the planted values', async () => {
    renderCase()

    const preview = screen.getByRole('img', { name: /first page of extraction-conditions-1/i })
    expect(preview).toHaveAttribute('srcset', expect.stringContaining('w960.webp 960w'))
    expect(preview).toHaveAttribute('width', '1241')

    await userEvent.click(screen.getByRole('button', { name: /enlarge the page/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('img')).toHaveAttribute(
      'src',
      'http://localhost:8007/media/benchmarks/ccc/preview.png',
    )
  })

  it('shows no preview when the case has none yet', () => {
    renderCase(makeCaseDetail({ preview: null }))

    expect(screen.queryByRole('button', { name: /enlarge the page/i })).toBeNull()
  })

  it('lists every tool that has been run on it', () => {
    renderCase()

    expect(screen.getByText('PDF Redaction')).toBeInTheDocument()
  })
})
