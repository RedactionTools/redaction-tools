import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getGetMeQueryKey } from '@/lib/api/generated/auth/auth'
import { getGetToolQueryKey, getListMyListingsQueryKey } from '@/lib/api/generated/catalog/catalog'
import { getStaffGetToolQueryKey } from '@/lib/api/generated/catalog-staff/catalog-staff'
import type { StaffToolOut } from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { makeStaffTool, makeToolDetail } from '../fixtures'
import { ToolProfile } from '../tool-profile'

const session = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('next-auth/react', () => ({
  useSession: () =>
    session.current
      ? { data: session.current, status: 'authenticated' }
      : { data: null, status: 'unauthenticated' },
  signIn: vi.fn(),
}))

const TOOL = makeToolDetail()

function stubFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

const UPDATED = { slug: TOOL.slug, changed: ['tagline'], listable: true, listability_reasons: [] }
const ME = { id: 'u1', email: 'ed@example.com', name: 'Ed', is_staff: true }

function render({ staff, record = makeStaffTool() }: { staff: boolean; record?: StaffToolOut }) {
  session.current = { accessToken: 'token' }
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(getGetToolQueryKey(TOOL.slug), TOOL)
  queryClient.setQueryData(getGetMeQueryKey(), { ...ME, is_staff: staff })
  queryClient.setQueryData(getListMyListingsQueryKey(), [])
  queryClient.setQueryData(getStaffGetToolQueryKey(TOOL.slug), record)
  return renderWithProviders(<ToolProfile slug={TOOL.slug} />, { queryClient })
}

describe('ToolProfile for staff', () => {
  beforeEach(() => {
    session.current = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offers staff an edit button on the tagline', () => {
    render({ staff: true })

    expect(screen.getByRole('button', { name: 'Edit tagline' })).toBeInTheDocument()
  })

  it('offers a signed-in reader who is not staff nothing to edit', () => {
    render({ staff: false })

    expect(screen.queryByRole('button', { name: /^edit /i })).not.toBeInTheDocument()
  })

  // One block, one save, one field: every field named in a write is a line in
  // the revision trail, and an unchanged one would be noise there.
  it('saves the tagline alone, then closes the editor', async () => {
    const fetchSpy = stubFetch(200, UPDATED)
    const user = userEvent.setup()
    render({ staff: true })

    await user.click(screen.getByRole('button', { name: 'Edit tagline' }))
    const input = screen.getByLabelText('Tagline')
    await user.clear(input)
    await user.type(input, 'Redact with care')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/catalog/staff/tools/adobe-acrobat')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ changes: { tagline: 'Redact with care' } })
    await waitFor(() => expect(screen.queryByLabelText('Tagline')).not.toBeInTheDocument())
  })

  // Strengths and limitations are lists, and an editor thinks of them as lines.
  it('edits the strengths one per line and saves them as a list', async () => {
    const fetchSpy = stubFetch(200, { ...UPDATED, changed: ['pros'] })
    const user = userEvent.setup()
    render({ staff: true })

    await user.click(screen.getByRole('button', { name: 'Edit strengths' }))
    const input = screen.getByLabelText('Strengths, one per line')
    await user.type(input, '{enter}Fast batch mode')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      changes: { pros: ['Removes underlying content and metadata properly', 'Fast batch mode'] },
    })
  })

  // The refusal is the service's own words - it names the field or the rule -
  // and an editor can only correct what they are told.
  it('shows the reason a save was refused', async () => {
    stubFetch(422, { detail: 'website_url: that address is not public.' })
    const user = userEvent.setup()
    render({ staff: true })

    await user.click(screen.getByRole('button', { name: 'Edit tagline' }))
    await user.type(screen.getByLabelText('Tagline'), '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('that address is not public')
    expect(screen.getByLabelText('Tagline')).toBeInTheDocument()
  })

  // A listing with no questions yet is exactly the one staff need to start.
  it('lets staff add the first question and answer', async () => {
    const fetchSpy = stubFetch(200, { ...UPDATED, changed: ['faq'] })
    const user = userEvent.setup()
    render({ staff: true })

    await user.click(screen.getByRole('button', { name: 'Edit questions' }))
    await user.click(screen.getByRole('button', { name: 'Add a question' }))
    await user.type(screen.getByLabelText('Question 1'), 'Is it free?')
    await user.type(screen.getByLabelText('Answer 1'), 'No, but there is a trial.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      changes: { faq: [{ question: 'Is it free?', answer: 'No, but there is a trial.' }] },
    })
  })

  // An edit can take a live page off the catalog - a cleared required field, a
  // plan with no price - and the public read then 404s. Staff have to be told,
  // on the page they are looking at, and told why.
  it('tells staff when the listing is not listable, and why', () => {
    render({
      staff: true,
      record: makeStaffTool({ listable: false, listability_reasons: ['Needs a tagline.'] }),
    })

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/not listed/i)
    expect(status).toHaveTextContent('Needs a tagline.')
  })

  // The editor's notes never reach the public page, so without the panel there
  // would be nowhere on it to edit them.
  it('reaches the fields the public page never shows', () => {
    render({ staff: true, record: makeStaffTool({ editor_notes: 'Recheck the trial.' }) })

    expect(screen.getByText('Recheck the trial.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit editor notes' })).toBeInTheDocument()
  })

  it('shows readers no staff panel', () => {
    render({ staff: false, record: makeStaffTool({ editor_notes: 'Recheck the trial.' }) })

    expect(screen.queryByText('Recheck the trial.')).not.toBeInTheDocument()
  })

  describe('plans', () => {
    async function openPlan(user: ReturnType<typeof userEvent.setup>, action: RegExp) {
      await user.click(screen.getByRole('button', { name: 'Edit plans' }))
      await user.click(screen.getByRole('button', { name: action }))
    }

    it('renames a plan without touching its price', async () => {
      const fetchSpy = stubFetch(200, { tool: TOOL.slug, code: 'pro', changed: ['name'] })
      const user = userEvent.setup()
      render({ staff: true })

      await openPlan(user, /details of acrobat pro/i)
      const name = screen.getByLabelText('Plan name')
      await user.clear(name)
      await user.type(name, 'Acrobat Pro DC')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toContain('/api/v1/catalog/staff/tools/adobe-acrobat/plans/pro')
      expect(JSON.parse(String(init?.body))).toEqual({ changes: { name: 'Acrobat Pro DC' } })
    })
    // A price is published, never edited: the form starts from today's figure
    // and saving opens a new current row in that slot, closing the old one.
    it('publishes a new price for a plan, starting from the current one', async () => {
      const fetchSpy = stubFetch(201, { changed: true, price: {}, previous: null })
      const user = userEvent.setup()
      render({ staff: true })

      await openPlan(user, /price of acrobat pro/i)
      const amount = screen.getByLabelText('Amount')
      expect(amount).toHaveValue('22.9900')
      await user.clear(amount)
      await user.type(amount, '24.99')
      await user.click(screen.getByRole('button', { name: 'Publish price' }))

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toContain('/plans/pro/prices')
      expect(JSON.parse(String(init?.body))).toMatchObject({
        amount: '24.99',
        unit: 'month',
        billing_period: 'monthly',
        currency: 'USD',
        is_overage: false,
      })
    })
    it('sets a cap on a plan', async () => {
      const fetchSpy = stubFetch(200, {
        tool: TOOL.slug,
        code: 'pro',
        kind: 'pages_per_month',
        label: 'Pages per month',
        display: '500 pages',
        created: true,
      })
      const user = userEvent.setup()
      render({ staff: true })

      await openPlan(user, /cap on acrobat pro/i)
      await user.selectOptions(screen.getByLabelText('Kind'), 'pages_per_month')
      await user.type(screen.getByLabelText('Value'), '500')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toContain('/plans/pro/limits/pages_per_month')
      expect(init?.method).toBe('PUT')
      expect(JSON.parse(String(init?.body))).toEqual({ value: 500, is_unlimited: false, note: '' })
    })

    it('adds a plan', async () => {
      const fetchSpy = stubFetch(201, {
        tool: TOOL.slug,
        code: 'team',
        name: 'Team',
        has_pricing_position: false,
      })
      const user = userEvent.setup()
      render({ staff: true })

      await user.click(screen.getByRole('button', { name: 'Edit plans' }))
      await user.click(screen.getByRole('button', { name: 'Add a plan' }))
      await user.type(screen.getByLabelText('Code'), 'team')
      await user.type(screen.getByLabelText('New plan name'), 'Team')
      await user.click(screen.getByRole('button', { name: 'Create plan' }))

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
      expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
        code: 'team',
        name: 'Team',
        changes: {},
      })
    })
  })
})
