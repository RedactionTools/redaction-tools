import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getGetCatalogStatsQueryKey } from '@/lib/api/generated/catalog/catalog'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { CatalogLede } from './catalog-lede'
import { makeStats } from './fixtures'

function render(stats = makeStats()) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getGetCatalogStatsQueryKey(), stats)
  return renderWithProviders(<CatalogLede />, { queryClient })
}

describe('CatalogLede', () => {
  it('opens with a standalone factual sentence carrying a count and a date', () => {
    render()

    const lede = screen.getByTestId('catalog-lede')
    expect(lede).toHaveTextContent('7 redaction tools')
    expect(lede).toHaveTextContent('17 September 2026')
    expect(lede).toHaveTextContent('3 have a genuine free tier')
  })

  it('states the price range without claiming a unit it cannot claim', () => {
    render()

    const lede = screen.getByTestId('catalog-lede')
    expect(lede).toHaveTextContent('entry prices run from $0 to $279')
    // The range spans per-month and per-seat-per-month figures, so it must not
    // present itself as a monthly range.
    expect(lede).not.toHaveTextContent('$279 per month')
  })

  it('does not claim a free-tier count it does not have', () => {
    render(makeStats({ with_free_tier: 0 }))

    expect(screen.getByTestId('catalog-lede')).not.toHaveTextContent('free tier')
  })
})
