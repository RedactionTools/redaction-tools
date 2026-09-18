import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { getListFacetsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { FacetDimensionOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { makeListing } from './fixtures'
import { ListingEditor } from './listing-editor'

const LISTING = makeListing()

const REVISION = {
  id: 3,
  tool: 'adobe-acrobat',
  changes: { tagline: 'Now with better redaction.' },
  status: 'submitted',
  admin_comment: '',
  created_at: '2026-09-18T00:00:00Z',
  applied_at: null,
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

const FACETS: FacetDimensionOut[] = [
  {
    code: 'media',
    label: 'Media',
    values: [
      { code: 'pdf', slug: 'pdf', label: 'PDF', has_landing_page: false, tool_count: 7 },
      { code: 'video', slug: 'video', label: 'Video', has_landing_page: false, tool_count: 1 },
    ],
  },
  {
    code: 'capability',
    label: 'Capability',
    values: [
      { code: 'ocr', slug: 'ocr', label: 'OCR', has_landing_page: false, tool_count: 4 },
      {
        code: 'batch',
        slug: 'batch',
        label: 'Batch processing',
        has_landing_page: false,
        tool_count: 5,
      },
    ],
  },
]

function render(listing = LISTING) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getListFacetsQueryKey(), FACETS)
  return renderWithProviders(<ListingEditor listing={listing} />, { queryClient })
}

/** Every case starts from the open form; the closed state is one button. */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /propose an edit/i }))
}

/** Change one field and send it, which is the shape of a real correction. */
async function proposeTagline(user: ReturnType<typeof userEvent.setup>) {
  const tagline = screen.getByLabelText('Tagline')
  await user.clear(tagline)
  await user.type(tagline, 'Now with better redaction.')
  await user.click(screen.getByRole('button', { name: /send for review/i }))
}

describe('ListingEditor', () => {
  // An owner arrives to correct one thing. Starting from blank fields would
  // make them retype the seven they are happy with.
  it('starts from what the listing says today', async () => {
    const user = userEvent.setup()
    render()

    await open(user)

    expect(screen.getByLabelText('Name')).toHaveValue('Adobe Acrobat')
    expect(screen.getByLabelText('Tagline')).toHaveValue('The incumbent PDF editor.')
  })

  // A vendor knows what their own tool does; the catalog knows what it is
  // allowed to be filed under. Offering the taxonomy is how those meet.
  it('offers the taxonomy, ticked to what the listing is filed under today', async () => {
    const user = userEvent.setup()
    render()

    await open(user)

    expect(screen.getByRole('checkbox', { name: 'PDF' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'OCR' })).not.toBeChecked()
  })

  // An owner who opens the form to look, edits, then thinks better of it should
  // not have to reload the page - and should not find yesterday's abandoned
  // draft waiting when they come back.
  it('discards an abandoned draft', async () => {
    const user = userEvent.setup()
    render()
    await open(user)

    await user.type(screen.getByLabelText('Tagline'), ' and more')
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await open(user)

    expect(screen.getByLabelText('Tagline')).toHaveValue('The incumbent PDF editor.')
  })

  it('discards abandoned facet ticks with the rest of the draft', async () => {
    const user = userEvent.setup()
    render()
    await open(user)

    await user.click(screen.getByRole('checkbox', { name: 'OCR' }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await open(user)

    expect(screen.getByRole('checkbox', { name: 'OCR' })).not.toBeChecked()
  })

  // The API refuses an empty proposal, and a round trip to be told you changed
  // nothing is a worse way to learn it than a button that is plainly inert.
  it('will not send a proposal that changes nothing', async () => {
    const user = userEvent.setup()
    render()

    await open(user)

    expect(screen.getByRole('button', { name: /send for review/i })).toBeDisabled()
  })

  // A revision records the values it was based on, and every field named in one
  // is a field an editor has to read and rule on. Sending the seven that did not
  // change would bury the one that did.
  it('proposes only the field that changed', async () => {
    const fetchSpy = stubFetch(201, REVISION)
    const user = userEvent.setup()
    render()
    await open(user)

    await proposeTagline(user)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/catalog/my-listings/adobe-acrobat/revisions')
    expect(JSON.parse(String(init?.body))).toEqual({
      changes: { tagline: 'Now with better redaction.' },
    })
  })

  // Facets are proposed as the whole list rather than a delta: that is what the
  // API applies, and it is what an editor has to be able to read in one go.
  it('proposes the facet list as a whole when one is ticked', async () => {
    const fetchSpy = stubFetch(201, REVISION)
    const user = userEvent.setup()
    render()
    await open(user)

    await user.click(screen.getByRole('checkbox', { name: 'OCR' }))
    await user.click(screen.getByRole('button', { name: /send for review/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      changes: { facet_slugs: ['manual-redaction', 'ocr', 'pdf'] },
    })
  })

  // The listing on the public page is unchanged until an editor applies the
  // revision. An owner who reads "saved" and goes to check would find their old
  // tagline and file a bug.
  it('reports the edit as queued rather than saved', async () => {
    stubFetch(201, REVISION)
    const user = userEvent.setup()
    render()
    await open(user)

    await proposeTagline(user)

    expect(await screen.findByRole('status')).toHaveTextContent(/review/i)
  })

  // The API refuses a bad URL against the field it came from. Flattening that
  // to "something went wrong" leaves an owner retyping the wrong box.
  it('reports a refusal against the field it names', async () => {
    stubFetch(422, {
      detail: [
        {
          type: 'value_error',
          loc: ['body', 'changes', 'website_url'],
          msg: 'That host is not allowed.',
        },
      ],
    })
    const user = userEvent.setup()
    render()
    await open(user)

    await proposeTagline(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /website_url: That host is not allowed/i,
    )
  })
})
