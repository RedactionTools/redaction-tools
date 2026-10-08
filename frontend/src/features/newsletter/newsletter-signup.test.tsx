import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { NewsletterSignup } from './newsletter-signup'

/** Answers every request with `status` and `body`, and records what was sent. */
function stubFetch(status = 204, body: unknown = null) {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  return () =>
    spy.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }))
}

afterEach(() => vi.restoreAllMocks())

describe('NewsletterSignup', () => {
  it('subscribes to the picked topics and asks the reader to confirm', async () => {
    const sent = stubFetch()
    renderWithProviders(<NewsletterSignup />)

    await userEvent.type(screen.getByLabelText('Email address'), 'reader@example.com')
    await userEvent.click(screen.getByRole('checkbox', { name: 'New tools' }))
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }))

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
    expect(sent()).toEqual([
      {
        url: expect.stringContaining('/api/v1/newsletter/subscriptions'),
        method: 'POST',
        body: { email: 'reader@example.com', reviews: true, new_tools: false, benchmarks: true },
      },
    ])
  })

  it('will not send without a topic', async () => {
    const sent = stubFetch()
    renderWithProviders(<NewsletterSignup />)

    await userEvent.type(screen.getByLabelText('Email address'), 'reader@example.com')
    for (const name of ['Reviews', 'New tools', 'Benchmarks']) {
      await userEvent.click(screen.getByRole('checkbox', { name }))
    }

    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled()
    expect(sent()).toEqual([])
  })

  it('shows what the API refused with', async () => {
    stubFetch(422, { detail: 'Enter a valid email address.' })
    renderWithProviders(<NewsletterSignup />)

    await userEvent.type(screen.getByLabelText('Email address'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
  })

  it('says so when the reader has tried too often', async () => {
    stubFetch(429, { detail: 'Too Many Requests' })
    renderWithProviders(<NewsletterSignup />)

    await userEvent.type(screen.getByLabelText('Email address'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i)
  })
})
