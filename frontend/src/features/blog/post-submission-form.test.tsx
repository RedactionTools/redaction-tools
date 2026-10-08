import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { PostSubmissionForm } from './post-submission-form'

// The real editor loads client-only through next/dynamic; what matters here is
// the value it hands back, so a labelled textarea stands in for it.
vi.mock('./markdown-editor', () => ({
  MarkdownEditor: ({
    id,
    value,
    onChange,
  }: {
    id: string
    value: string
    onChange: (value: string) => void
  }) => <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />,
}))

const BODY = 'A scan carries two copies of every word.'

function stubFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText(/^title/i), 'Redacting scanned PDFs')
  await userEvent.type(screen.getByLabelText(/summary/i), 'What OCR misses.')
  await userEvent.type(screen.getByLabelText(/tags/i), 'OCR, Guides, ')
  await userEvent.type(screen.getByLabelText(/^post/i), BODY)
  await userEvent.click(screen.getByRole('button', { name: /submit/i }))
}

describe('PostSubmissionForm', () => {
  it('sends the post and its byline to the review queue', async () => {
    const fetchSpy = stubFetch(201, { id: 1, status: 'pending' })
    renderWithProviders(<PostSubmissionForm defaultAuthor="Ada Writer" />)

    await userEvent.type(screen.getByLabelText(/role/i), 'Records officer')
    await userEvent.type(screen.getByLabelText(/link 1/i), 'https://ada.example')
    await fillAndSubmit()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/blog/submissions')
    expect(JSON.parse(String(init?.body))).toEqual({
      title: 'Redacting scanned PDFs',
      description: 'What OCR misses.',
      tags: ['OCR', 'Guides'],
      body_md: BODY,
      author_name: 'Ada Writer',
      author_role: 'Records officer',
      author_bio: '',
      author_links: ['https://ada.example'],
    })
  })

  it('shows why the API refused, and keeps what was written', async () => {
    stubFetch(422, { detail: 'A post needs at least 300 characters.' })
    renderWithProviders(<PostSubmissionForm defaultAuthor="Ada Writer" />)

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('at least 300 characters')
    expect(screen.getByLabelText(/^post/i)).toHaveValue(BODY)
  })

  it('says the post is queued for an editor, not published', async () => {
    stubFetch(201, { id: 1, status: 'pending' })
    renderWithProviders(<PostSubmissionForm defaultAuthor="Ada Writer" />)

    await fillAndSubmit()

    expect(await screen.findByRole('status')).toHaveTextContent(/editor/i)
    expect(screen.getByRole('link', { name: /your activity/i })).toHaveAttribute(
      'href',
      '/activity',
    )
  })
})
