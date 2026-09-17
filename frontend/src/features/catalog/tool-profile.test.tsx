import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getGetToolQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { ToolDetailOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { makeToolDetail } from './fixtures'
import { ToolProfile } from './tool-profile'

function render(tool: ToolDetailOut = makeToolDetail()) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getGetToolQueryKey(tool.slug), tool)
  return renderWithProviders(<ToolProfile slug={tool.slug} />, { queryClient })
}

describe('ToolProfile', () => {
  it('states the price as a sentence carrying unit, currency and date', () => {
    render()

    expect(
      screen.getByText('Adobe Acrobat costs from $22.99 USD per month, as of 15 September 2026.'),
    ).toBeInTheDocument()
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

    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      '/images/tools/adobe-acrobat.svg',
    )
  })

  it('falls back to a monogram when a listing has no logo yet', () => {
    render(makeToolDetail({ logo_url: '' }))

    expect(screen.getByTestId('tool-monogram')).toHaveTextContent('AA')
  })
})
