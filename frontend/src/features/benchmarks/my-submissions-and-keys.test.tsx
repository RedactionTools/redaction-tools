import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { getListMyApiKeysQueryKey } from '@/lib/api/generated/auth/auth'
import { getListMyBenchmarkSubmissionsQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import type { MySubmissionOut } from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { ApiKeysPanel } from './api-keys-panel'
import { makeApiKey, makeMyRun, makeMySubmission, makeRate, makeRunScreenshot } from './fixtures'
import { MySubmissions } from './my-submissions'

let fetchSpy: MockInstance<typeof fetch>

function respond(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond([]))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MySubmissions', () => {
  function render(rows: MySubmissionOut[]) {
    const queryClient = makeTestQueryClient()
    queryClient.setQueryData(getListMyBenchmarkSubmissionsQueryKey(), rows)
    return renderWithProviders(<MySubmissions />, { queryClient })
  }

  it('shows each submission with where it stands', () => {
    render([makeMySubmission({ status: 'pending_review' })])

    const row = screen.getByTestId(`submission-${makeMySubmission().id}`)
    expect(within(row).getByText('PDF Redaction')).toBeInTheDocument()
    expect(within(row).getByText('Awaiting review')).toBeInTheDocument()
  })

  it('shows why a submission was rejected', () => {
    render([makeMySubmission({ status: 'rejected', review_note: 'Wrong tool uploaded.' })])

    expect(screen.getByText('Wrong tool uploaded.')).toBeInTheDocument()
  })

  it('shows each run, and why one could not be scored', () => {
    render([
      makeMySubmission({
        status: 'scoring_failed',
        runs: [
          {
            run_id: 'r1',
            case_id: 'pii-detection-1',
            status: 'failed',
            error: 'PdfReadError: the file is encrypted',
            verification: 'not_needed',
            counts: { TP: 0, FN: 0, FP: 0, TN: 0, unsupported: 0, undecided: 0 },
            leak_rate: makeRate(0, 0),
            overlay: null,
            screenshots: [],
          },
        ],
      }),
    ])

    expect(screen.getByText('pii-detection-1')).toBeInTheDocument()
    expect(screen.getByText(/the file is encrypted/)).toBeInTheDocument()
  })

  it('adds screenshots to a run already sent', async () => {
    fetchSpy.mockResolvedValue(respond(makeMyRun(), 201))
    render([makeMySubmission({ status: 'approved', runs: [makeMyRun()] })])

    const shot = new File(['png'], 'settings.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/add screenshots to pii-detection-1/i), shot)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/benchmarks/runs/r1/screenshots')
    expect(init?.method).toBe('POST')
    expect((init?.body as FormData).getAll('screenshots')).toEqual([shot])
  })

  it('marks a screenshot that waits for an editor', () => {
    const run = makeMyRun({
      screenshots: [
        { ...makeRunScreenshot(), status: 'published' },
        { ...makeRunScreenshot({ url: 'http://x/new.png' }), status: 'pending' },
      ],
    })
    render([makeMySubmission({ status: 'approved', runs: [run] })])

    expect(screen.getAllByRole('img', { name: /screenshot \d of pii-detection-1/i })).toHaveLength(
      2,
    )
    expect(screen.getAllByText('Awaiting review')).toHaveLength(1)
  })

  it('offers no screenshots for a submission taken back or turned down', () => {
    render([makeMySubmission({ status: 'rejected', review_note: 'No.', runs: [makeMyRun()] })])

    expect(screen.queryByLabelText(/add screenshots/i)).toBeNull()
  })

  // Uploading creates the runs; only sending queues them. A draft left behind - the
  // submit page reloaded before "Send" - is sent from here.
  it('sends a draft that was never sent', async () => {
    fetchSpy.mockResolvedValue(respond(makeMySubmission({ status: 'scoring' })))
    render([makeMySubmission({ status: 'draft', runs: [makeMyRun({ status: 'queued' })] })])

    await userEvent.click(screen.getByRole('button', { name: /send for scoring/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain(`/benchmarks/submissions/${makeMySubmission().id}/finalize`)
    expect(init?.method).toBe('POST')
  })

  it('says a draft’s runs are not sent, rather than queued', () => {
    render([makeMySubmission({ status: 'draft', runs: [makeMyRun({ status: 'queued' })] })])

    expect(screen.getByText('Not sent')).toBeInTheDocument()
    expect(screen.queryByText('queued')).toBeNull()
  })

  it('offers nothing to send for a draft with no runs yet', () => {
    render([makeMySubmission({ status: 'draft', runs: [] })])

    expect(screen.queryByRole('button', { name: /send for scoring/i })).toBeNull()
  })

  it('withdraws a submission that is not yet published', async () => {
    render([makeMySubmission({ status: 'pending_review' })])

    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain(`/benchmarks/submissions/${makeMySubmission().id}`)
    expect(init?.method).toBe('DELETE')
  })

  it('offers no withdrawal once a result is published', () => {
    render([makeMySubmission({ status: 'approved' })])

    expect(screen.queryByRole('button', { name: /withdraw/i })).toBeNull()
  })

  it('says how to start when there is nothing yet', () => {
    render([])

    expect(screen.getByRole('link', { name: /submit results/i })).toBeInTheDocument()
  })
})

describe('ApiKeysPanel', () => {
  function render(keys = [makeApiKey()]) {
    const queryClient = makeTestQueryClient()
    queryClient.setQueryData(getListMyApiKeysQueryKey(), keys)
    return renderWithProviders(<ApiKeysPanel />, { queryClient })
  }

  it('lists keys by prefix and label, never the secret', () => {
    render()

    expect(screen.getByText('laptop')).toBeInTheDocument()
    expect(screen.getByText('Ab12Cd34…')).toBeInTheDocument()
  })

  it('shows a new key once, with the command that uses it', async () => {
    fetchSpy.mockResolvedValue(
      respond({ ...makeApiKey({ prefix: 'Zz99Yy88', label: 'CI' }), key: 'Zz99Yy88.s3cret' }, 201),
    )
    render([])

    await userEvent.type(screen.getByLabelText(/label/i), 'CI')
    await userEvent.click(screen.getByRole('button', { name: /create key/i }))

    expect(await screen.findByText('Zz99Yy88.s3cret')).toBeInTheDocument()
    expect(screen.getByText(/PDFREDEVAL_API_KEY=Zz99Yy88\.s3cret/)).toBeInTheDocument()
    expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument()
  })

  it('revokes a key', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }))
    render()

    await userEvent.click(screen.getByRole('button', { name: /revoke laptop/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/auth/api-keys/Ab12Cd34')
    expect(init?.method).toBe('DELETE')
  })

  it('marks a revoked key and offers nothing to do with it', () => {
    render([makeApiKey({ revoked: true })])

    expect(screen.getByText('Revoked')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke/i })).toBeNull()
  })
})
