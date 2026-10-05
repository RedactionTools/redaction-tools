import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getGetMeQueryKey } from '@/lib/api/generated/auth/auth'

import {
  getGetBenchmarkCaseQueryKey,
  getGetBenchmarkRunQueryKey,
} from '@/lib/api/generated/benchmarks/benchmarks'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { CaseView } from './case-view'
import { makeCaseDetail, makeRun, makeRunDetail, makeRunScreenshot } from './fixtures'
import { RunReportView } from './run-report-view'

const session = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('next-auth/react', () => ({
  useSession: () =>
    session.current
      ? { data: session.current, status: 'authenticated' }
      : { data: null, status: 'unauthenticated' },
}))

afterEach(() => {
  session.current = null
  vi.restoreAllMocks()
})

const RUN_ID = makeRun().run_id

function renderRun(run = makeRunDetail(), { staff = false } = {}) {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(getGetBenchmarkRunQueryKey(RUN_ID), run)
  if (staff) {
    session.current = { accessToken: 'token' }
    queryClient.setQueryData(getGetMeQueryKey(), {
      id: 's',
      email: 'ed@example.com',
      name: 'Ed',
      is_staff: true,
    })
  }
  return renderWithProviders(<RunReportView suite="pdf" runId={RUN_ID} />, { queryClient })
}

describe('RunReportView', () => {
  it('links the leaderboard, the tool report and the case by their plain URLs', () => {
    renderRun()

    expect(screen.getByRole('link', { name: /pdf benchmark v0\.1\.1/i })).toHaveAttribute(
      'href',
      '/benchmarks/pdf',
    )
    expect(screen.getByRole('link', { name: 'PDF Redaction' })).toHaveAttribute(
      'href',
      '/benchmarks/pdf/tools/pdf-redaction',
    )
    expect(screen.getByRole('link', { name: /the case, and every tool/i })).toHaveAttribute(
      'href',
      '/benchmarks/pdf/cases/extraction-conditions-1',
    )
  })

  it('names a superseded revision in every link it makes', () => {
    renderRun(makeRunDetail({ revision_is_current: false }))

    expect(screen.getByRole('link', { name: /the case, and every tool/i })).toHaveAttribute(
      'href',
      '/benchmarks/pdf/cases/extraction-conditions-1?revision=v0.1.1',
    )
  })

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

  it('shows the screenshots the run was made with, and enlarges one', async () => {
    renderRun(
      makeRunDetail({
        screenshots: [
          makeRunScreenshot(),
          makeRunScreenshot({ url: 'http://localhost:8007/media/benchmarks/ddd/screenshot.png' }),
        ],
      }),
    )

    const section = screen.getByTestId('run-screenshots')
    expect(within(section).getByRole('heading', { name: 'Screenshots' })).toBeInTheDocument()
    const carousel = within(section).getByRole('region', { name: /screenshots of pdf redaction/i })
    await userEvent.click(within(carousel).getByRole('button', { name: /next/i }))
    expect(within(carousel).getByText('2 / 2')).toBeInTheDocument()
    await userEvent.click(
      within(section).getByRole('button', { name: /enlarge screenshot 2 of 2/i }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(/screenshot 2 of 2/i)
  })

  it('lets staff add screenshots to the run', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }))
    renderRun(makeRunDetail(), { staff: true })

    const shot = new File(['png'], 'settings.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/add screenshots to this run/i), shot)

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/screenshots'))).toBe(true),
    )
    const [url] = fetchSpy.mock.calls.find(([u]) => String(u).includes('/screenshots'))!
    expect(String(url)).toContain(`/benchmarks/runs/${RUN_ID}/screenshots`)
  })

  it('offers no screenshot upload to anyone but staff', () => {
    renderRun()

    expect(screen.queryByLabelText(/add screenshots/i)).toBeNull()
  })

  it('has no screenshots section when the run has none', () => {
    renderRun()

    expect(screen.queryByTestId('run-screenshots')).not.toBeInTheDocument()
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

  it('links back to the leaderboard by its plain URL when the revision is current', () => {
    renderCase()

    expect(screen.getByRole('link', { name: /pdf benchmark v0\.1\.1/i })).toHaveAttribute(
      'href',
      '/benchmarks/pdf',
    )
  })

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
