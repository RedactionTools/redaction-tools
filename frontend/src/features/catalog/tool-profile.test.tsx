import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { getGetToolQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { ToolDetailOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { makeScreenshot, makeToolDetail } from './fixtures'
import { ToolProfile } from './tool-profile'

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
}))

function render(tool: ToolDetailOut = makeToolDetail()) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getGetToolQueryKey(tool.slug), tool)
  return renderWithProviders(<ToolProfile slug={tool.slug} />, { queryClient })
}

describe('ToolProfile', () => {
  // The page is a comparison, and the reader who has decided needs the way out
  // to the tool itself. Nofollow: it is a reference, not an endorsement we pass
  // ranking through - and the same link every listing carries, ours included.
  // Our own measurement of the tool, beside the vendor's claims: an internal
  // link, so followed, one per suite the tool has published results in.
  it("links to the tool's benchmark report in each suite it has results in", () => {
    render(makeToolDetail({ benchmarks: [{ suite: 'pdf', name: 'PDF redaction' }] }))

    const link = screen.getByRole('link', { name: /pdf redaction benchmark/i })
    expect(link).toHaveAttribute('href', '/benchmarks/pdf/tools/adobe-acrobat')
    expect(link).not.toHaveAttribute('rel')
  })

  it('offers no benchmark link before the tool has results', () => {
    render()

    expect(screen.queryByRole('link', { name: /benchmark/i })).not.toBeInTheDocument()
  })

  it('links to the tool itself from the top of the page, nofollow', () => {
    render()

    const link = screen.getByRole('link', { name: /visit adobe acrobat/i })
    expect(link).toHaveAttribute('href', 'https://www.adobe.com/acrobat.html')
    expect(link.getAttribute('rel')?.split(' ')).toContain('nofollow')
  })

  // The listing is the vendor's page too, and the profile is where they arrive.
  // Anywhere else and the claim flow is a route only staff know about.
  it('lets the vendor claim the listing from the page itself', () => {
    render()

    expect(screen.getByRole('button', { name: /claim this listing/i })).toBeInTheDocument()
  })

  // Above the plan table on purpose: a buyer decides what the tool is before
  // they care what it costs, and the pictures are the only part of the page that
  // shows them the thing itself.
  it('shows the listing gallery when it has one', () => {
    render(makeToolDetail({ screenshots: [makeScreenshot()] }))

    expect(screen.getByRole('heading', { name: 'Screenshots' })).toBeInTheDocument()
  })

  it('states the price as a sentence carrying unit, currency and date', () => {
    render()

    expect(
      screen.getByText('Adobe Acrobat costs from $22.99 USD per month, as of 15 September 2026.'),
    ).toBeInTheDocument()
  })

  // The capability facets are recorded for every tool and were the one part of
  // that record the page never showed. They are named, not slugged: "true
  // content removal" is the difference between redaction and a black rectangle.
  it('names what the tool can do, not the slugs it is filed under', () => {
    render()

    const capabilities = screen.getByTestId('capabilities')
    expect(within(capabilities).getByText('OCR')).toBeInTheDocument()
    expect(within(capabilities).getByText('True content removal')).toBeInTheDocument()
    expect(within(capabilities).queryByText('true-removal')).not.toBeInTheDocument()
  })

  // Not every tool has them recorded yet, and a heading over an empty list
  // reads as "this tool does nothing" rather than "we have not checked".
  it('drops the section when no capability is recorded', () => {
    render(makeToolDetail({ facets: [] }))

    expect(screen.queryByTestId('capabilities')).not.toBeInTheDocument()
  })

  it('carries a key-facts list a reader or a model can lift', () => {
    render()

    const facts = screen.getByTestId('key-facts')
    expect(within(facts).getByText('Vendor')).toBeInTheDocument()
    expect(within(facts).getByText('Adobe')).toBeInTheDocument()
    expect(within(facts).getByText('Free tier')).toBeInTheDocument()
    expect(within(facts).getByText('No')).toBeInTheDocument()
  })

  it('describes a trial as a trial in the key facts', () => {
    render()

    expect(within(screen.getByTestId('key-facts')).getByText('7-day trial')).toBeInTheDocument()
  })

  it('lists every public plan with its price', () => {
    render()

    const plans = screen.getByTestId('plan-table')
    expect(within(plans).getByText('Acrobat Pro')).toBeInTheDocument()
    expect(within(plans).getByText('$22.99 per month')).toBeInTheDocument()
  })

  it('shows a plan with no price as a trial rather than as free', () => {
    render()

    const plans = screen.getByTestId('plan-table')
    const row = within(plans).getByTestId('plan-row-trial')
    expect(within(row).getByText('7-day trial')).toBeInTheDocument()
  })

  it('explains the provenance marks rather than leaving them as glyphs', () => {
    render()

    expect(screen.getByTestId('provenance-legend')).toHaveTextContent(/entered by our editors/i)
  })

  it('links to the vendor pricing page the figure came from', () => {
    render()

    expect(screen.getByRole('link', { name: /vendor.s pricing page/i })).toHaveAttribute(
      'href',
      'https://www.adobe.com/acrobat/pricing.html',
    )
  })

  it('fences vendor copy away from our own editorial', () => {
    render(makeToolDetail({ vendor_copy_md: 'Acrobat is the worlds best PDF tool.' }))

    const vendorBlock = screen.getByTestId('vendor-copy')
    expect(vendorBlock).toHaveTextContent('From the vendor')
    expect(vendorBlock).toHaveTextContent('worlds best')
  })

  it('omits the vendor block entirely when there is no vendor copy', () => {
    render()

    expect(screen.queryByTestId('vendor-copy')).not.toBeInTheDocument()
  })

  it('discloses a first-party listing', () => {
    render(makeToolDetail({ slug: 'pdf-redaction', name: 'PDF Redaction', is_first_party: true }))

    expect(screen.getByText(/our own product/i)).toBeInTheDocument()
  })

  it('shows the logo in the profile header', () => {
    render()

    // Queried as an element, not by role: the logo is `aria-hidden`, because
    // the tool's name is right beside it.
    expect(document.querySelector('img')).toHaveAttribute('src', '/images/tools/adobe-acrobat.svg')
  })

  it('falls back to a monogram when a listing has no logo yet', () => {
    render(makeToolDetail({ logo_url: '' }))

    expect(screen.getByTestId('tool-monogram')).toHaveTextContent('AA')
  })

  it('carries the cost calculator alongside the plan table', () => {
    render()

    expect(screen.getByTestId('document-cost-calculator')).toBeInTheDocument()
  })
})

describe('the FAQ', () => {
  const withFaq = (faq: { question: string; answer: string }[]) => makeToolDetail({ faq })

  it('shows the questions the listing answers', () => {
    render(withFaq([{ question: 'Does it remove the text?', answer: 'Yes, on export.' }]))

    expect(screen.getByRole('heading', { name: /common questions/i })).toBeInTheDocument()
    expect(screen.getByText('Does it remove the text?')).toBeInTheDocument()
    expect(screen.getByText('Yes, on export.')).toBeInTheDocument()
  })

  // A heading over nothing tells a reader the page has answers it does not.
  it('raises no heading when the listing answers none', () => {
    render(makeToolDetail({ faq: [] }))

    expect(screen.queryByRole('heading', { name: /common questions/i })).not.toBeInTheDocument()
  })
})
