import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { NewsletterConfirm, NewsletterUnsubscribe } from './newsletter-link'

function stubFetch(status: number, body: unknown = null) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

function sentBodies(spy: ReturnType<typeof stubFetch>) {
  return spy.mock.calls.map(([url, init]) => [String(url), JSON.parse(String(init?.body))])
}

afterEach(() => vi.restoreAllMocks())

describe('NewsletterConfirm', () => {
  // Mail scanners open links before people do; a confirmation they could fire
  // would make the double opt-in single.
  it('confirms only on the click, then names the topics', async () => {
    const spy = stubFetch(200, { email: 'reader@example.com', topics: ['reviews', 'benchmarks'] })
    renderWithProviders(<NewsletterConfirm token="tok" />)

    expect(spy).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm subscription' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'reader@example.com will get Reviews and Benchmarks.',
    )
    expect(sentBodies(spy)).toEqual([
      [expect.stringContaining('/api/v1/newsletter/confirmations'), { token: 'tok' }],
    ])
  })

  it('explains a dead link', async () => {
    stubFetch(400, { detail: 'This link is invalid or has expired.' })
    renderWithProviders(<NewsletterConfirm token="old" />)

    await userEvent.click(screen.getByRole('button', { name: 'Confirm subscription' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is invalid or has expired.',
    )
  })

  it('has nothing to confirm without a token', () => {
    renderWithProviders(<NewsletterConfirm token="" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/link is incomplete/i)).toBeInTheDocument()
  })
})

describe('NewsletterUnsubscribe', () => {
  it('unsubscribes on the click', async () => {
    const spy = stubFetch(204)
    renderWithProviders(<NewsletterUnsubscribe token="tok" />)

    expect(spy).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/unsubscribed/i)
    expect(sentBodies(spy)).toEqual([
      [expect.stringContaining('/api/v1/newsletter/unsubscriptions'), { token: 'tok' }],
    ])
  })
})
