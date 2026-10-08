import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getGetClaimInviteQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { ClaimInviteOut } from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { ClaimInvite } from './claim-invite'

const useSession = vi.fn()
const signIn = vi.fn()

vi.mock('next-auth/react', () => ({
  useSession: () => useSession(),
  signIn: (...args: unknown[]) => signIn(...args),
}))

const TOKEN = 'abc123'
const SESSION = { user: { name: 'Ada', email: 'ada@example.com' }, expires: '2099-01-01' }
const INVITE: ClaimInviteOut = {
  tool: 'adobe-acrobat',
  tool_name: 'Adobe Acrobat',
  redeemed: false,
}

const CLAIM = {
  id: 7,
  tool: 'adobe-acrobat',
  work_email: 'ceo@adobe.com',
  domain_matched: true,
  status: 'approved',
  email_verified_at: '2026-09-29T00:00:00Z',
  created_at: '2026-09-29T00:00:00Z',
}

function stubFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function render(invite: ClaimInviteOut = INVITE) {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(getGetClaimInviteQueryKey(TOKEN), invite)
  return renderWithProviders(<ClaimInvite token={TOKEN} />, { queryClient })
}

describe('ClaimInvite', () => {
  beforeEach(() => {
    signIn.mockClear()
    useSession.mockReturnValue({ data: SESSION, status: 'authenticated' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('names the listing the link is for', () => {
    render()

    expect(screen.getByRole('heading', { name: /adobe acrobat/i })).toBeInTheDocument()
  })

  it('asks a signed-out owner to sign in and brings them back here', async () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: /sign in to accept/i }))

    expect(signIn).toHaveBeenCalledWith(undefined, { redirectTo: `/claim/${TOKEN}` })
    expect(screen.queryByRole('button', { name: /^accept/i })).not.toBeInTheDocument()
  })

  it('redeems the link and points the new owner at their listings', async () => {
    const fetch = stubFetch(200, CLAIM)
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: /accept/i }))

    expect(String(fetch.mock.calls[0][0])).toContain(`/catalog/claim-invites/${TOKEN}/redeem`)
    expect(await screen.findByRole('link', { name: /your listings/i })).toHaveAttribute(
      'href',
      '/my-listings',
    )
  })

  it('says why a redemption was refused', async () => {
    stubFetch(404, { detail: 'This claim link has already been used.' })
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: /accept/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already been used/i)
  })

  it('tells a reader when the link has been used', () => {
    render({ ...INVITE, redeemed: true })

    expect(screen.getByText(/already been used/i)).toBeInTheDocument()
  })
})
