import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getListMyListingsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { MyListingOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { MyListingsPanel } from './my-listings-panel'

const LISTING: MyListingOut = {
  slug: 'adobe-acrobat',
  name: 'Adobe Acrobat',
  status: 'published',
  tagline: 'The incumbent PDF editor.',
  pricing_url: 'https://www.adobe.com/acrobat/pricing.html',
}

function render(listings: MyListingOut[] = [LISTING]) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getListMyListingsQueryKey(), listings)
  return renderWithProviders(<MyListingsPanel />, { queryClient })
}

describe('MyListingsPanel', () => {
  it('lists the tools you maintain', () => {
    render()

    expect(screen.getByRole('link', { name: /adobe acrobat/i })).toHaveAttribute(
      'href',
      '/tool/adobe-acrobat',
    )
  })

  it('says plainly that edits are proposals, not changes', () => {
    render()

    expect(screen.getByText(/reviewed by an editor/i)).toBeInTheDocument()
  })

  it('names what you cannot change, so the boundary needs no support thread', () => {
    render()

    const readOnly = screen.getByTestId('owner-readonly-note')
    expect(readOnly).toHaveTextContent(/verdict/i)
    expect(readOnly).toHaveTextContent(/benchmark/i)
  })

  it('points an unclaimed account at the claim flow instead of showing an empty box', () => {
    render([])

    expect(screen.getByText(/do not maintain any listings/i)).toBeInTheDocument()
  })
})
