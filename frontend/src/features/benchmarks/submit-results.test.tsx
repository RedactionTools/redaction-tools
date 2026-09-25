import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { getGetBenchmarkSuiteQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import { getListToolsQueryKey } from '@/lib/api/generated/catalog/catalog'
import { makePage, makeTool } from '@/features/catalog/fixtures'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { renderFirstPage } from '@/lib/benchmarks/pdf-preview'

import { makeCase, makeMySubmission, makeSuite } from './fixtures'
import { SUBMIT_TOOL_PARAMS, SubmitResults } from './submit-results'

// jsdom has no canvas, so pdf.js cannot render here: the one module that drives it is
// replaced, and what is tested is what the page does with a rendered first page.
vi.mock('@/lib/benchmarks/pdf-preview', () => ({ renderFirstPage: vi.fn() }))
const renderMock = vi.mocked(renderFirstPage)

const cases = [makeCase(), makeCase({ case_id: 'pii-detection-1', family: 'pii-detection' })]

function render() {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(
    getGetBenchmarkSuiteQueryKey('pdf', { scope: 'all' }),
    makeSuite({ cases }),
  )
  queryClient.setQueryData(
    getListToolsQueryKey(SUBMIT_TOOL_PARAMS),
    makePage([makeTool({ slug: 'pdf-redaction', name: 'PDF Redaction' }), makeTool()]),
  )
  return renderWithProviders(<SubmitResults suite="pdf" />, { queryClient })
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchSpy: MockInstance<typeof fetch>
const draft = makeMySubmission()

beforeEach(() => {
  renderMock.mockResolvedValue({ url: 'blob:first-page', width: 620, height: 877, pageCount: 1 })
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/submissions')) return respond(draft, 201)
    if (url.endsWith('/outputs')) return respond({ run_id: 'r', status: 'queued' }, 201)
    if (url.endsWith('/finalize')) return respond({ ...draft, status: 'scoring' })
    return respond({}, 404)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function start() {
  await userEvent.selectOptions(screen.getByLabelText(/^tool$/i), 'pdf-redaction')
  await userEvent.selectOptions(screen.getByLabelText(/how you ran it/i), 'web')
  await userEvent.type(screen.getByLabelText(/plan or tier/i), 'Free')
  await userEvent.click(screen.getByRole('button', { name: /start/i }))
}

function pdf(name: string) {
  return new File(['%PDF-1.7'], name, { type: 'application/pdf' })
}

describe('SubmitResults', () => {
  it('opens a submission for the chosen tool and surface', async () => {
    render()

    await start()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/benchmarks/suites/pdf/submissions')
    expect(JSON.parse(init?.body as string)).toMatchObject({
      tool: 'pdf-redaction',
      surface: 'web',
      origin: 'upload',
      tier: 'Free',
    })
  })

  it('matches each file to its case by name, and asks about the ones it cannot', async () => {
    render()
    await start()

    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('redacted-pii-detection-1.pdf'),
      pdf('output.pdf'),
    ])

    expect(screen.getByLabelText('Case for redacted-pii-detection-1.pdf')).toHaveValue(
      'pii-detection-1',
    )
    expect(screen.getByLabelText('Case for output.pdf')).toHaveValue('')
    expect(screen.getByRole('button', { name: /upload 1 file/i })).toBeEnabled()
  })

  it('uploads each matched file against its case, then sends the submission', async () => {
    render()
    await start()
    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('redacted-pii-detection-1.pdf'),
    ])

    await userEvent.click(screen.getByRole('button', { name: /upload 1 file/i }))
    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([url]) => String(url).endsWith('/outputs'))).toBe(true),
    )
    const upload = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/outputs'))!
    const body = upload[1]?.body as FormData
    expect(body.get('case_id')).toBe('pii-detection-1')
    expect((body.get('pdf') as File).name).toBe('redacted-pii-detection-1.pdf')

    await userEvent.click(await screen.findByRole('button', { name: /send for scoring/i }))

    expect(await screen.findByText(/we are scoring it now/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /your submissions/i })).toHaveAttribute(
      'href',
      '/benchmarks/submissions',
    )
  })

  it('shows why the site refused a file', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/submissions')) return respond(draft, 201)
      return respond({ detail: 'That PDF has 2 pages; pii-detection-1 has 1.' }, 422)
    })
    render()
    await start()
    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('pii-detection-1.pdf'),
    ])

    await userEvent.click(screen.getByRole('button', { name: /upload 1 file/i }))

    expect(await screen.findByText(/has 2 pages/)).toBeInTheDocument()
  })

  it('offers a button to choose the files', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
    render()
    await start()

    await userEvent.click(await screen.findByRole('button', { name: /choose files/i }))

    expect(click).toHaveBeenCalled()
  })

  it('previews each file before it is uploaded', async () => {
    render()
    await start()

    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('redacted-pii-detection-1.pdf'),
    ])

    const thumbnail = await screen.findByRole('img', {
      name: 'First page of redacted-pii-detection-1.pdf',
    })
    expect(thumbnail).toHaveAttribute('src', 'blob:first-page')
    expect(renderMock).toHaveBeenCalledWith(expect.any(File), expect.any(Number))
  })

  it('shows the file beside the case it was matched to, to catch a wrong file', async () => {
    render()
    await start()
    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('redacted-pii-detection-1.pdf'),
    ])

    await userEvent.click(
      await screen.findByRole('button', { name: /compare redacted-pii-detection-1\.pdf/i }),
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('img', { name: /your file/i })).toHaveAttribute(
      'src',
      'blob:first-page',
    )
    expect(
      within(dialog).getByRole('img', { name: /first page of pii-detection-1/i }),
    ).toBeInTheDocument()
  })

  it('warns before upload when the page count is not the case’s', async () => {
    renderMock.mockResolvedValue({ url: 'blob:x', width: 620, height: 877, pageCount: 3 })
    render()
    await start()

    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('redacted-pii-detection-1.pdf'),
    ])

    expect(await screen.findByText(/3 pages; pii-detection-1 has 1/)).toBeInTheDocument()
  })

  it('says so when a file cannot be read as a PDF', async () => {
    renderMock.mockRejectedValue(new Error('Invalid PDF structure'))
    render()
    await start()

    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('redacted-pii-detection-1.pdf'),
    ])

    expect(await screen.findByText(/could not be read as a pdf/i)).toBeInTheDocument()
  })

  it('removes a file before it is uploaded', async () => {
    render()
    await start()
    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('redacted-pii-detection-1.pdf'),
      pdf('output.pdf'),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Remove output.pdf' }))

    expect(screen.queryByLabelText('Case for output.pdf')).toBeNull()
    expect(screen.getByLabelText('Case for redacted-pii-detection-1.pdf')).toHaveValue(
      'pii-detection-1',
    )
  })

  it('offers no removal once a file is uploaded', async () => {
    render()
    await start()
    await userEvent.upload(await screen.findByLabelText(/redacted pdfs/i), [
      pdf('redacted-pii-detection-1.pdf'),
    ])

    await userEvent.click(screen.getByRole('button', { name: /upload 1 file/i }))

    await screen.findByText('Uploaded')
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
  })

  it('offers the cases to download, all at once or one by one', () => {
    render()

    expect(screen.getByRole('link', { name: /download all 2 cases/i })).toHaveAttribute(
      'href',
      expect.stringContaining('.zip'),
    )
    expect(screen.getByRole('link', { name: /download pii-detection-1/i })).toHaveAttribute(
      'href',
      expect.stringContaining('.pdf'),
    )
    expect(screen.getByRole('link', { name: /download extraction-conditions-1/i })).toHaveAttribute(
      'download',
    )
  })

  it('keeps the downloads in reach while files are being added', async () => {
    render()
    await start()

    expect(await screen.findByRole('link', { name: /download all 2 cases/i })).toBeInTheDocument()
  })
})
