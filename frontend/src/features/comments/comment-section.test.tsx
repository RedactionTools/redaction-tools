import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getGetMeQueryKey } from '@/lib/api/generated/auth/auth'
import {
  getListBlogCommentsQueryKey,
  getListMyPendingCommentsQueryKey,
  getListToolCommentsQueryKey,
} from '@/lib/api/generated/comments/comments'
import { getStaffListCommentsQueryKey } from '@/lib/api/generated/comments-staff/comments-staff'
import type { CommentOut } from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { CommentSection } from './comment-section'
import { makeComment, makeStaffComment } from './fixtures'

const session = vi.hoisted(() => ({ current: null as unknown }))
const signIn = vi.hoisted(() => vi.fn())

vi.mock('next-auth/react', () => ({
  useSession: () =>
    session.current
      ? { data: session.current, status: 'authenticated' }
      : { data: null, status: 'unauthenticated' },
  signIn,
}))

const SLUG = 'pdf-redaction'
const ME = { id: 'me', email: 'me@example.com', name: 'Me', is_staff: false }

/**
 * Records writes and answers each with `body`. The re-reads every write
 * triggers answer with empty lists, so a refetch never hands a list hook a
 * single comment.
 */
function stubFetch(body: unknown = {}, status = 201) {
  const json = (payload: unknown, code: number) =>
    new Response(code === 204 ? null : JSON.stringify(payload), {
      status: code,
      headers: { 'Content-Type': 'application/json' },
    })
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (!init?.method || init.method === 'GET') {
      return json(String(url).includes('/comments/staff/') ? { count: 0, items: [] } : [], 200)
    }
    return json(body, status)
  })
  return () =>
    spy.mock.calls
      .filter(([, init]) => init?.method && init.method !== 'GET')
      .map(([url, init]) => ({
        url: String(url),
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }))
}

function render({
  comments = [] as CommentOut[],
  signedIn = false,
  staff = false,
  mine = [] as CommentOut[],
  queue = [] as CommentOut[],
  targetType = 'tool' as 'tool' | 'blog',
} = {}) {
  session.current = signedIn ? { accessToken: 'token' } : null
  const queryClient = makeTestQueryClient()
  const key =
    targetType === 'tool' ? getListToolCommentsQueryKey(SLUG) : getListBlogCommentsQueryKey(SLUG)
  queryClient.setQueryData(key, comments)
  queryClient.setQueryData(getGetMeQueryKey(), { ...ME, is_staff: staff })
  queryClient.setQueryData(
    getListMyPendingCommentsQueryKey({ target_type: targetType, slug: SLUG }),
    mine,
  )
  queryClient.setQueryData(
    getStaffListCommentsQueryKey({ target_type: targetType, slug: SLUG, status: 'pending' }),
    { count: queue.length, items: queue.map((comment) => makeStaffComment(comment)) },
  )
  return renderWithProviders(<CommentSection targetType={targetType} slug={SLUG} />, {
    queryClient,
  })
}

describe('CommentSection', () => {
  beforeEach(() => {
    session.current = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows published comments with a count', () => {
    render({ comments: [makeComment({ body: 'Fast enough?' })] })

    expect(screen.getByRole('heading', { name: 'Comments (1)' })).toBeInTheDocument()
    expect(screen.getByText('Fast enough?')).toBeInTheDocument()
  })

  it('anchors each comment so an email can link to it', () => {
    render({ comments: [makeComment({ id: 42 })] })

    expect(document.getElementById('comment-42')).not.toBeNull()
  })

  it('invites the first comment when there are none', () => {
    render()

    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument()
  })

  it('asks a signed-out reader to sign in rather than offering a form', async () => {
    render()

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in to comment' }))
    expect(signIn).toHaveBeenCalledWith()
  })

  it('nests replies under the comment they answer', () => {
    render({
      comments: [
        makeComment({ id: 1, body: 'Root' }),
        makeComment({ id: 2, parent_id: 1, depth: 1, body: 'Reply' }),
      ],
    })

    const root = document.getElementById('comment-1')!
    expect(within(root).getByText('Reply')).toBeInTheDocument()
  })

  it('keeps a placeholder where a removed comment still has replies', () => {
    render({
      comments: [
        makeComment({ id: 1, status: 'removed', body: null, author: null }),
        makeComment({ id: 2, parent_id: 1, depth: 1, body: 'Reply' }),
      ],
    })

    expect(screen.getByText('This comment was removed.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comments (1)' })).toBeInTheDocument()
  })

  it('badges staff and the tool vendor', () => {
    render({
      comments: [
        makeComment({ id: 1, author: { id: 's', name: 'Ed', is_staff: true, is_vendor: false } }),
        makeComment({ id: 2, author: { id: 'v', name: 'Vee', is_staff: false, is_vendor: true } }),
      ],
    })

    expect(within(document.getElementById('comment-1')!).getByText('Staff')).toBeInTheDocument()
    expect(within(document.getElementById('comment-2')!).getByText('Vendor')).toBeInTheDocument()
  })

  it('posts a comment on the page', async () => {
    const writes = stubFetch(makeComment({ id: 7, status: 'pending' }))
    render({ signedIn: true })

    await userEvent.type(screen.getByLabelText('Add a comment'), 'Does it OCR?')
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() =>
      expect(writes()).toEqual([
        {
          url: expect.stringContaining('/api/v1/comments/'),
          method: 'POST',
          body: { target_type: 'tool', slug: SLUG, body: 'Does it OCR?', parent_id: null },
        },
      ]),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(/waiting for review/i)
  })

  it('shows the reason a comment was refused', async () => {
    stubFetch({ detail: 'A comment cannot be empty.' }, 422)
    render({ signedIn: true })

    await userEvent.type(screen.getByLabelText('Add a comment'), ' ')
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A comment cannot be empty.')
  })

  it('replies to a comment', async () => {
    const writes = stubFetch(makeComment({ id: 8, parent_id: 1, depth: 1 }))
    render({ signedIn: true, comments: [makeComment({ id: 1 })] })

    await userEvent.click(screen.getByRole('button', { name: 'Reply' }))
    await userEvent.type(screen.getByLabelText('Reply to Ada'), 'Yes')
    await userEvent.click(screen.getByRole('button', { name: 'Post reply' }))

    await waitFor(() => expect(writes()[0].body).toMatchObject({ body: 'Yes', parent_id: 1 }))
  })

  it('shows an author their own comment that is awaiting review', () => {
    render({
      signedIn: true,
      mine: [makeComment({ id: 3, status: 'pending', body: 'Mine', author: { ...author('me') } })],
    })

    const mine = document.getElementById('comment-3')!
    expect(within(mine).getByText('Awaiting review')).toBeInTheDocument()
  })

  it('lets an author edit their comment', async () => {
    const writes = stubFetch(makeComment({ id: 3, body: 'Fixed' }), 200)
    render({
      signedIn: true,
      comments: [makeComment({ id: 3, body: 'Typo', author: author('me') })],
    })

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const box = screen.getByLabelText('Edit your comment')
    await userEvent.clear(box)
    await userEvent.type(box, 'Fixed')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(writes()).toEqual([
        {
          url: expect.stringContaining('/api/v1/comments/3'),
          method: 'PATCH',
          body: { body: 'Fixed' },
        },
      ]),
    )
  })

  it('lets an author delete their comment', async () => {
    const writes = stubFetch(undefined, 204)
    render({ signedIn: true, comments: [makeComment({ id: 3, author: author('me') })] })

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))

    await waitFor(() =>
      expect(writes()).toEqual([
        { url: expect.stringContaining('/api/v1/comments/3'), method: 'DELETE', body: undefined },
      ]),
    )
  })

  it("does not offer to edit someone else's comment", () => {
    render({ signedIn: true, comments: [makeComment({ id: 3 })] })

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('shows staff the comments waiting for review on this page, with controls', async () => {
    const writes = stubFetch(makeStaffComment({ id: 9, status: 'published' }), 200)
    render({
      signedIn: true,
      staff: true,
      queue: [makeComment({ id: 9, status: 'pending', body: 'Waiting' })],
    })

    const waiting = document.getElementById('comment-9')!
    expect(within(waiting).getByText('Awaiting review')).toBeInTheDocument()
    await userEvent.click(within(waiting).getByRole('button', { name: 'Publish' }))

    await waitFor(() =>
      expect(writes()).toEqual([
        {
          url: expect.stringContaining('/api/v1/comments/staff/9/review'),
          method: 'POST',
          body: { status: 'published', note: '' },
        },
      ]),
    )
  })

  it('lets staff remove a published comment', async () => {
    const writes = stubFetch(makeStaffComment({ id: 4, status: 'removed' }), 200)
    render({ signedIn: true, staff: true, comments: [makeComment({ id: 4 })] })

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(writes()[0].body).toEqual({ status: 'removed', note: '' }))
  })

  it('does not show moderation controls to readers', () => {
    render({ signedIn: true, comments: [makeComment({ id: 4 })] })

    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('reads a blog post comments from the blog route', () => {
    render({ targetType: 'blog', comments: [makeComment({ body: 'On the post' })] })

    expect(screen.getByText('On the post')).toBeInTheDocument()
  })
})

function author(id: string) {
  return { id, name: 'Me', is_staff: false, is_vendor: false }
}
