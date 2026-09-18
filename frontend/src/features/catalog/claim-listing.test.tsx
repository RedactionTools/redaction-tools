import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getListMyListingsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { MyListingOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { ClaimListing } from './claim-listing'
import { makeListing, makeToolDetail } from './fixtures'

const useSession = vi.fn()
const signIn = vi.fn()

vi.mock('next-auth/react', () => ({
  useSession: () => useSession(),
  signIn: (...args: unknown[]) => signIn(...args),
}))

const TOOL = makeToolDetail()

const SESSION = { user: { name: 'Ada Lovelace', email: 'ada@example.com' }, expires: '2099-01-01' }

beforeEach(() => {
  signIn.mockClear()
  useSession.mockReturnValue({ data: SESSION, status: 'authenticated' })
})

const CLAIM = {
  id: 7,
  tool: 'adobe-acrobat',
  work_email: 'ada@adobe.com',
  domain_matched: true,
  status: 'pending_verification',
  email_verified_at: null,
  created_at: '2026-09-18T00:00:00Z',
}

const VERIFIED = {
  ...CLAIM,
  status: 'pending_review',
  email_verified_at: '2026-09-18T00:05:00Z',
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(status, body))
}

function render(listings: MyListingOut[] = []) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getListMyListingsQueryKey(), listings)
  return renderWithProviders(<ClaimListing tool={TOOL} />, { queryClient })
}

/** A first visit, with the answer to "do you already own this?" still in
 *  flight. */
function renderBeforeListingsLoad() {
  return renderWithProviders(<ClaimListing tool={TOOL} />, { queryClient: makeQueryClient() })
}

/** Open the form and send a claim, which is the preamble to every later step. */
async function claim(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /claim this listing/i }))
  await user.type(screen.getByLabelText(/work email/i), 'ada@adobe.com')
  await user.click(screen.getByRole('button', { name: /send me a code/i }))
}

/** The second half: type the emailed code and confirm it. */
async function confirm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/code/i), '123456')
  await user.click(screen.getByRole('button', { name: /confirm/i }))
}

describe('ClaimListing', () => {
  it('offers the vendor a way to claim the listing', () => {
    render()

    expect(screen.getByRole('button', { name: /claim this listing/i })).toBeInTheDocument()
  })

  // Claiming is an authenticated act the API refuses outright without a token,
  // so a signed-out reader is asked to sign in rather than handed a form whose
  // submission could only fail.
  // A session whose token exchange or refresh failed cannot reach the API, so
  // it counts as signed out here rather than offering a form that would 401.
  it('treats a session that cannot call the API as signed out', () => {
    useSession.mockReturnValue({
      data: { ...SESSION, error: 'RefreshAccessTokenError' },
      status: 'authenticated',
    })
    render()

    expect(screen.getByRole('button', { name: /sign in to claim/i })).toBeInTheDocument()
  })

  it('asks a signed-out reader to sign in first', async () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: /sign in to claim/i }))

    expect(signIn).toHaveBeenCalledWith('google')
  })

  // Asking an owner whether they work for the vendor is the catalog forgetting
  // a claim it already approved.
  it('says nothing about claiming to someone who already maintains the listing', () => {
    render([makeListing({ slug: TOOL.slug })])

    expect(screen.queryByText(/do you work for/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /claim this listing/i })).not.toBeInTheDocument()
  })

  // The answer arrives a moment after the page does. Rendering the invitation
  // in the meantime shows an owner the one prompt this is meant to spare them.
  it('holds the invitation until it knows whether the reader is an owner', () => {
    renderBeforeListingsLoad()

    expect(screen.queryByText(/do you work for/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('claim-listing-skeleton')).toBeInTheDocument()
  })

  it('asks for a work email once the claim is started', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: /claim this listing/i }))

    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument()
  })

  it('sends the claim against the tool being read', async () => {
    const fetchSpy = stubFetch(201, CLAIM)
    const user = userEvent.setup()
    render()

    await claim(user)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/catalog/claims')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      tool: 'adobe-acrobat',
      work_email: 'ada@adobe.com',
    })
  })

  // The code is the whole of the email check, so the step has to say where it
  // was sent - a typo in the address is otherwise a silent dead end.
  it('asks for the emailed code, naming the address it went to', async () => {
    stubFetch(201, CLAIM)
    const user = userEvent.setup()
    render()

    await claim(user)

    expect(await screen.findByLabelText(/code/i)).toBeInTheDocument()
    expect(screen.getByText(/ada@adobe\.com/)).toBeInTheDocument()
  })

  it('confirms the code against the claim it was issued for', async () => {
    const fetchSpy = stubFetch(201, CLAIM)
    const user = userEvent.setup()
    render()
    await claim(user)

    fetchSpy.mockResolvedValue(response(200, VERIFIED))
    await confirm(user)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url, init] = fetchSpy.mock.calls[1]
    expect(String(url)).toContain('/api/v1/catalog/claims/7/verify')
    expect(JSON.parse(String(init?.body))).toEqual({ code: '123456' })
  })

  // A confirmed code proves an address can receive mail, nothing more. Staff
  // still decide, and saying so here is what keeps the claimant from reading
  // silence as approval.
  it('promises a review rather than the listing once the code is confirmed', async () => {
    const fetchSpy = stubFetch(201, CLAIM)
    const user = userEvent.setup()
    render()
    await claim(user)

    fetchSpy.mockResolvedValue(response(200, VERIFIED))
    await confirm(user)

    expect(await screen.findByRole('status')).toHaveTextContent(/review/i)
  })

  // The API's own refusals say something the claimant can act on - that they
  // already hold a claim, or that the address was rejected. A generic message
  // would leave them retrying the same thing.
  it('passes an API refusal straight through', async () => {
    stubFetch(409, { detail: 'You have already claimed this listing.' })
    const user = userEvent.setup()
    render()

    await claim(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/already claimed/i)
  })

  it('reports a rejected code without dropping the reader out of the step', async () => {
    const fetchSpy = stubFetch(201, CLAIM)
    const user = userEvent.setup()
    render()
    await claim(user)

    fetchSpy.mockResolvedValue(response(400, { detail: 'That code is not valid.' }))
    await confirm(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid/i)
    expect(screen.getByLabelText(/code/i)).toBeInTheDocument()
  })

  // A matching domain is not proof of who someone is, so every claim is read by
  // a person. These two fields are what they read.
  it('sends the role and evidence staff decide on', async () => {
    const fetchSpy = stubFetch(201, CLAIM)
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: /claim this listing/i }))
    await user.type(screen.getByLabelText(/work email/i), 'ada@adobe.com')
    await user.type(screen.getByLabelText(/your role/i), 'Head of Product')
    await user.type(screen.getByLabelText(/anything that helps/i), 'I am on the about page.')
    await user.click(screen.getByRole('button', { name: /send me a code/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({
      role: 'Head of Product',
      evidence: 'I am on the about page.',
    })
  })
})
