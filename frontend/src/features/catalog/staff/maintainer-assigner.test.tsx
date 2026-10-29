import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { MaintainerAssigner } from './maintainer-assigner'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Answers the assignment with `body` and every account search with `accounts`. */
function stubFetch(status: number, body: unknown, accounts: unknown[] = []) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input) =>
      String(input).includes('/catalog/staff/users') ? json(200, accounts) : json(status, body),
    )
}

function assignCalls(fetch: ReturnType<typeof stubFetch>) {
  return fetch.mock.calls.filter(([url]) => String(url).includes('/maintainers'))
}

describe('MaintainerAssigner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('assigns the account staff pick to this listing', async () => {
    const fetch = stubFetch(200, { tool: 'adobe-acrobat', maintainers: ['jeff@blinded.example'] }, [
      { id: 'a1', email: 'jeff@blinded.example', name: 'Jeff Nixon' },
    ])
    const user = userEvent.setup()
    renderWithProviders(<MaintainerAssigner slug="adobe-acrobat" />)

    await user.click(screen.getByRole('button', { name: /add maintainer/i }))
    await user.type(screen.getByLabelText(/account/i), 'jeff')
    await user.click(await screen.findByRole('button', { name: /jeff nixon/i }))
    await user.click(screen.getByRole('button', { name: /^assign$/i }))

    const [url, init] = assignCalls(fetch)[0]
    expect(String(url)).toContain('/catalog/staff/tools/adobe-acrobat/maintainers')
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'jeff@blinded.example' })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'jeff@blinded.example now maintains this listing.',
    )
  })

  it('shows why the server refused', async () => {
    stubFetch(422, { detail: "No account uses 'x@y.example'. Send a claim link instead." })
    const user = userEvent.setup()
    renderWithProviders(<MaintainerAssigner slug="adobe-acrobat" />)

    await user.click(screen.getByRole('button', { name: /add maintainer/i }))
    await user.type(screen.getByLabelText(/account/i), 'x@y.example')
    await user.click(screen.getByRole('button', { name: /^assign$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/send a claim link instead/i)
  })
})
