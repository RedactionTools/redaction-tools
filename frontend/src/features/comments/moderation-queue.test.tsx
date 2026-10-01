import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getStaffGetCommentSettingsQueryKey,
  getStaffListCommentsQueryKey,
} from '@/lib/api/generated/comments-staff/comments-staff'
import type { StaffCommentOut } from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { makeStaffComment } from './fixtures'
import { CommentSettingsCard, ModerationQueue } from './moderation-queue'

function stubFetch(body: unknown) {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const payload =
      !init?.method || init.method === 'GET'
        ? String(url).includes('/settings')
          ? { auto_approve: false, trusted_after: 3 }
          : { count: 0, items: [] }
        : body
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return () =>
    spy.mock.calls
      .filter(([, init]) => init?.method && init.method !== 'GET')
      .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) }))
}

function renderQueue(items: StaffCommentOut[], status = 'pending') {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(getStaffListCommentsQueryKey({ status, limit: 50, offset: 0 }), {
    count: items.length,
    items,
  })
  return renderWithProviders(<ModerationQueue />, { queryClient })
}

describe('ModerationQueue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists comments waiting for review with the page they are on', () => {
    renderQueue([makeStaffComment({ id: 3, body: 'Is it fast?' })])

    const row = screen.getByRole('listitem')
    expect(within(row).getByText('Is it fast?')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'PDF Redaction' })).toHaveAttribute(
      'href',
      '/tool/pdf-redaction#comment-3',
    )
  })

  it('links a blog comment to its post', () => {
    renderQueue([
      makeStaffComment({
        id: 4,
        target_type: 'blog',
        target_slug: 'hello',
        target_title: 'hello',
      }),
    ])

    expect(screen.getByRole('link', { name: 'hello' })).toHaveAttribute(
      'href',
      '/blog/hello#comment-4',
    )
  })

  it('shows what a reply answers', () => {
    renderQueue([makeStaffComment({ parent_body: 'The original question' })])

    expect(screen.getByText(/The original question/)).toBeInTheDocument()
  })

  it('says when the queue is empty', () => {
    renderQueue([])

    expect(screen.getByText(/nothing waiting for review/i)).toBeInTheDocument()
  })

  it('rejects with a note', async () => {
    const writes = stubFetch(makeStaffComment({ id: 3, status: 'rejected' }))
    renderQueue([makeStaffComment({ id: 3 })])

    await userEvent.type(screen.getByLabelText('Note (optional)'), 'Off topic')
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))

    await waitFor(() =>
      expect(writes()).toEqual([
        {
          url: expect.stringContaining('/api/v1/comments/staff/3/review'),
          body: { status: 'rejected', note: 'Off topic' },
        },
      ]),
    )
  })

  it('switches between statuses', async () => {
    stubFetch({})
    renderQueue([])

    await userEvent.click(screen.getByRole('tab', { name: 'Published' }))

    expect(screen.getByRole('tab', { name: 'Published' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('CommentSettingsCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderCard(settings = { auto_approve: false, trusted_after: 3 }) {
    const queryClient = makeTestQueryClient()
    queryClient.setQueryData(getStaffGetCommentSettingsQueryKey(), settings)
    return renderWithProviders(<CommentSettingsCard />, { queryClient })
  }

  it('shows the current settings', () => {
    renderCard({ auto_approve: true, trusted_after: 5 })

    expect(screen.getByLabelText(/publish every comment/i)).toBeChecked()
    expect(screen.getByLabelText(/trusted after/i)).toHaveValue(5)
  })

  it('switches auto-approve on', async () => {
    const writes = stubFetch({ auto_approve: true, trusted_after: 3 })
    renderCard()

    await userEvent.click(screen.getByLabelText(/publish every comment/i))

    await waitFor(() =>
      expect(writes()).toEqual([
        {
          url: expect.stringContaining('/api/v1/comments/staff/settings'),
          body: { auto_approve: true },
        },
      ]),
    )
  })

  it('saves a new trust threshold', async () => {
    const writes = stubFetch({ auto_approve: false, trusted_after: 0 })
    renderCard()

    const input = screen.getByLabelText(/trusted after/i)
    await userEvent.clear(input)
    await userEvent.type(input, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(writes()[0].body).toEqual({ trusted_after: 0 }))
  })
})
