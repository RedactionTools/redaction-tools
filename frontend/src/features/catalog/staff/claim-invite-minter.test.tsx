import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { ClaimInviteMinter } from './claim-invite-minter'

const URL = 'http://localhost:3007/claim/abc123'

const INVITE = {
  id: 3,
  tool: 'adobe-acrobat',
  email: 'ceo@adobe.com',
  url: URL,
  emailed: true,
  created_at: '2026-09-29T00:00:00Z',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Answers the mint with `body` and every account search with `accounts`. */
function stubFetch(status: number, body: unknown, accounts: unknown[] = []) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input) =>
      String(input).includes('/catalog/staff/users') ? json(200, accounts) : json(status, body),
    )
}

function mintCalls(fetch: ReturnType<typeof stubFetch>) {
  return fetch.mock.calls.filter(([url]) => String(url).includes('/claim-invites'))
}

async function mint(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /create claim link/i }))
  await user.type(screen.getByLabelText(/owner's email/i), 'ceo@adobe.com')
  await user.click(screen.getByRole('button', { name: /create link/i }))
}

describe('ClaimInviteMinter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks the API for a link for this listing and address', async () => {
    const fetch = stubFetch(201, INVITE)
    const user = userEvent.setup()
    renderWithProviders(<ClaimInviteMinter slug="adobe-acrobat" toolName="Adobe Acrobat" />)

    await mint(user)

    const [url, init] = mintCalls(fetch)[0]
    expect(String(url)).toContain('/catalog/staff/tools/adobe-acrobat/claim-invites')
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'ceo@adobe.com' })
  })

  // Owners who already signed in once have an account: staff pick it rather
  // than retype an address and risk a typo in a credential's destination.
  it('fills the address from an existing account staff pick', async () => {
    const fetch = stubFetch(201, INVITE, [
      { id: 'a1', email: 'jeff@blinded.example', name: 'Jeff Nixon' },
    ])
    const user = userEvent.setup()
    renderWithProviders(<ClaimInviteMinter slug="adobe-acrobat" toolName="Adobe Acrobat" />)

    await user.click(screen.getByRole('button', { name: /create claim link/i }))
    await user.type(screen.getByLabelText(/owner's email/i), 'jeff')
    await user.click(await screen.findByRole('button', { name: /jeff nixon/i }))
    expect(screen.getByLabelText(/owner's email/i)).toHaveValue('jeff@blinded.example')
    await user.click(screen.getByRole('button', { name: /create link/i }))

    const [, init] = mintCalls(fetch)[0]
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'jeff@blinded.example' })
  })

  it('shows the link once minted, ready to copy or email', async () => {
    stubFetch(201, INVITE)
    const user = userEvent.setup()
    renderWithProviders(<ClaimInviteMinter slug="adobe-acrobat" toolName="Adobe Acrobat" />)

    await mint(user)

    expect(await screen.findByDisplayValue(URL)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    const email = screen.getByRole('link', { name: /open in email/i })
    expect(email.getAttribute('href')).toMatch(/^mailto:ceo%40adobe\.com\?/)
    expect(decodeURIComponent(email.getAttribute('href') ?? '')).toContain(URL)
  })

  it('says the link went out by email', async () => {
    stubFetch(201, INVITE)
    const user = userEvent.setup()
    renderWithProviders(<ClaimInviteMinter slug="adobe-acrobat" toolName="Adobe Acrobat" />)

    await mint(user)

    expect(await screen.findByRole('status')).toHaveTextContent('Emailed to ceo@adobe.com')
  })

  // The link is not stored anywhere, so when the mail fails this panel is the
  // only way it reaches the owner.
  it('tells staff to send it themselves when the email failed', async () => {
    stubFetch(201, { ...INVITE, emailed: false })
    const user = userEvent.setup()
    renderWithProviders(<ClaimInviteMinter slug="adobe-acrobat" toolName="Adobe Acrobat" />)

    await mint(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not email it/i)
  })

  it('warns that the link is shown only once', async () => {
    stubFetch(201, INVITE)
    const user = userEvent.setup()
    renderWithProviders(<ClaimInviteMinter slug="adobe-acrobat" toolName="Adobe Acrobat" />)

    await mint(user)

    expect(await screen.findByText(/only time this link is shown/i)).toBeInTheDocument()
  })

  it('says what the API refused', async () => {
    stubFetch(422, { detail: "'nope' is not a valid email address." })
    const user = userEvent.setup()
    renderWithProviders(<ClaimInviteMinter slug="adobe-acrobat" toolName="Adobe Acrobat" />)

    await mint(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a valid email/i)
  })
})
