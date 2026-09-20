import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getListMyScreenshotsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { MyScreenshotOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { ScreenshotUploader } from './screenshot-uploader'

function makeMine(overrides: Partial<MyScreenshotOut> = {}): MyScreenshotOut {
  return {
    id: 1,
    url: 'http://localhost:8007/media/screenshots/abc/w960.webp',
    srcset: 'http://localhost:8007/media/screenshots/abc/w480.webp 480w',
    width: 1600,
    height: 900,
    alt: 'The redaction panel',
    caption: '',
    status: 'pending',
    review_note: '',
    created_at: '2026-09-18T00:00:00Z',
    ...overrides,
  }
}

function render(rows: MyScreenshotOut[] = []) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getListMyScreenshotsQueryKey('adobe-acrobat'), rows)
  return renderWithProviders(<ScreenshotUploader slug="adobe-acrobat" name="Adobe Acrobat" />, {
    queryClient,
  })
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(makeMine()), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ScreenshotUploader', () => {
  // The state an owner most needs explained: their picture is stored but is not
  // on the listing, and nothing on the public page would tell them why.
  it('says that an upload waits for an editor', () => {
    render([makeMine()])

    expect(within(screen.getByTestId('my-screenshots')).getByText(/pending/i)).toBeInTheDocument()
  })

  it('shows why a picture was turned down rather than letting it vanish', () => {
    render([makeMine({ status: 'rejected', review_note: 'Shows a different product.' })])

    expect(screen.getByText('Shows a different product.')).toBeInTheDocument()
  })

  it('sends the file and its alt text as one multipart request', async () => {
    render()

    await userEvent.upload(
      screen.getByLabelText(/screenshot file/i),
      new File(['x'], 'panel.png', { type: 'image/png' }),
    )
    await userEvent.type(screen.getByLabelText(/what it shows/i), 'The redaction panel')
    await userEvent.click(screen.getByRole('button', { name: /upload/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const body = fetchSpy.mock.calls[0][1]?.body as FormData
    expect(body.get('alt_text')).toBe('The redaction panel')
    expect((body.get('image') as File).name).toBe('panel.png')
  })

  // Alt text is the one field a vendor cannot leave to us: we are not looking at
  // their product, and an empty one would be refused by the API anyway.
  it('will not upload without alt text', async () => {
    render()

    await userEvent.upload(
      screen.getByLabelText(/screenshot file/i),
      new File(['x'], 'panel.png', { type: 'image/png' }),
    )

    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })

  it('reports the API refusal verbatim, because it names what was wrong', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ loc: ['body', 'image'], msg: 'Too large.' }] }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    render()

    await userEvent.upload(
      screen.getByLabelText(/screenshot file/i),
      new File(['x'], 'huge.png', { type: 'image/png' }),
    )
    await userEvent.type(screen.getByLabelText(/what it shows/i), 'A huge capture')
    await userEvent.click(screen.getByRole('button', { name: /upload/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too large.')
  })
})
